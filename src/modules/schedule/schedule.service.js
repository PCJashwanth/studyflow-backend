import { prisma } from '../../lib/prisma.js'
import { groqEnabled, groqChatJSON } from '../../integrations/groq.js'

const SLOT_HOURS = [8, 10, 12, 14, 16, 18, 20, 22] // the 8 daily 2h slots
const OPEN = ['NOT_STARTED', 'IN_PROGRESS']

// Monday 00:00 UTC of the week containing `d`.
function mondayOf(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function toDates(weekStart, day, startHour, hours) {
  const start = new Date(weekStart)
  start.setUTCDate(start.getUTCDate() + day)
  start.setUTCHours(startHour, 0, 0, 0)
  const end = new Date(start)
  end.setUTCHours(start.getUTCHours() + Math.max(1, Math.round(hours)))
  return { start, end }
}

async function buildContext(userId, weekStart) {
  const [tasks, prefs] = await Promise.all([
    prisma.task.findMany({
      where: { course: { userId }, status: { in: OPEN } },
      include: { course: { select: { code: true } } },
      orderBy: [{ deadline: 'asc' }, { priority: 'desc' }],
    }),
    prisma.studentPreferences.findUnique({ where: { userId } }),
  ])

  const grid = Array.isArray(prefs?.availabilityGrid) ? prefs.availabilityGrid : null
  const now = new Date()
  const freeSlots = []
  for (let s = 0; s < SLOT_HOURS.length; s++) {
    for (let d = 0; d < 7; d++) {
      // If the student saved a grid, honor it. Otherwise default to afternoons/evenings free.
      const isFree = grid ? grid[s]?.[d] === 'free' : SLOT_HOURS[s] >= 16
      if (!isFree) continue
      // Never schedule into slots that have already passed.
      if (toDates(weekStart, d, SLOT_HOURS[s], 1).start < now) continue
      freeSlots.push({ day: d, startHour: SLOT_HOURS[s] })
    }
  }

  return {
    tasks,
    freeSlots,
    prefs: {
      maxStudyHours: prefs?.maxStudyHours ?? 6,
      focusTime: prefs?.focusTime ?? 'Evening',
      minBreakMins: prefs?.minBreakMins ?? 15,
    },
  }
}

// Ask Groq to allocate tasks into free slots. Returns raw block objects.
async function generateWithAI(ctx, weekStart) {
  const system =
    'You are StudyFlow, an academic study-planning assistant. You allocate a student\'s ' +
    'outstanding tasks into their free time slots for one week. Respond with ONLY valid JSON.'
  const user = JSON.stringify({
    weekStartMonday: weekStart.toISOString().slice(0, 10),
    preferences: ctx.prefs,
    freeSlots: ctx.freeSlots,
    tasks: ctx.tasks.map((t, i) => ({
      index: i,
      title: t.title,
      course: t.course.code,
      priority: t.priority,
      effortHours: t.effortHours,
      deadline: t.deadline.toISOString().slice(0, 10),
    })),
    outputSpec:
      'Return {"blocks":[{"taskIndex":int,"day":0-6 (0=Mon),"startHour":int matching a freeSlot,' +
      '"hours":1-2,"rationale":"short reason citing deadline/priority/focus time"}]}. ' +
      'Only use provided freeSlots. Never exceed preferences.maxStudyHours per day. ' +
      'Prioritize earlier deadlines and higher priority. Prefer the preferred focus time.',
  })
  const out = await groqChatJSON(system, user)
  return Array.isArray(out.blocks) ? out.blocks : []
}

// Deterministic fallback: greedily fill free slots by deadline order.
function generateWithRules(ctx) {
  const remaining = ctx.tasks.map((t, i) => ({ index: i, left: t.effortHours, deadline: t.deadline }))
  const perDay = {}
  const raw = []
  for (const slot of [...ctx.freeSlots].sort((a, b) => a.day - b.day || a.startHour - b.startHour)) {
    const cand = remaining.find((r) => r.left > 0)
    if (!cand) break
    if ((perDay[slot.day] || 0) + 2 > ctx.prefs.maxStudyHours) continue
    const hours = Math.min(2, cand.left)
    cand.left -= hours
    perDay[slot.day] = (perDay[slot.day] || 0) + hours
    raw.push({
      taskIndex: cand.index,
      day: slot.day,
      startHour: slot.startHour,
      hours,
      rationale: `Placed in a free slot before the ${cand.deadline.toISOString().slice(0, 10)} deadline.`,
    })
  }
  return raw
}

// Validate raw blocks against tasks/slots/prefs and turn them into DB rows.
function toRows(rawBlocks, ctx, weekStart, source) {
  const free = new Set(ctx.freeSlots.map((s) => `${s.day}-${s.startHour}`))
  const perDay = {}
  const rows = []
  for (const b of rawBlocks) {
    const ti = Number(b.taskIndex)
    const day = Number(b.day)
    const startHour = Number(b.startHour)
    const hours = Math.min(2, Math.max(1, Number(b.hours) || 2))
    if (!Number.isInteger(ti) || ti < 0 || ti >= ctx.tasks.length) continue
    if (!(day >= 0 && day <= 6) || !SLOT_HOURS.includes(startHour)) continue
    if (!free.has(`${day}-${startHour}`)) continue // slot free & not already used
    if ((perDay[day] || 0) + hours > ctx.prefs.maxStudyHours) continue

    const task = ctx.tasks[ti]
    const { start, end } = toDates(weekStart, day, startHour, hours)
    rows.push({
      title: `Study: ${task.title}`,
      start,
      end,
      rationale: String(b.rationale || '').slice(0, 300),
      source,
      taskId: task.id,
    })
    free.delete(`${day}-${startHour}`)
    perDay[day] = (perDay[day] || 0) + hours
  }
  return rows
}

// Produce the new set of block rows (AI first, rule-based fallback) — not persisted.
async function planSchedule(weekStart, userId) {
  const ctx = await buildContext(userId, weekStart)
  if (ctx.tasks.length === 0 || ctx.freeSlots.length === 0) return { source: 'RULE', rows: [] }

  let rows = []
  let source = 'RULE'
  if (groqEnabled()) {
    try {
      rows = toRows(await generateWithAI(ctx, weekStart), ctx, weekStart, 'AI')
      if (rows.length) source = 'AI'
    } catch (e) {
      console.error('Groq generation failed, falling back to rules:', e.message)
    }
  }
  if (!rows.length) {
    rows = toRows(generateWithRules(ctx), ctx, weekStart, 'RULE')
    source = 'RULE'
  }
  return { source, rows }
}

function persist(userId, weekStart, rows) {
  return prisma.$transaction(async (tx) => {
    await tx.scheduleBlock.deleteMany({ where: { userId, weekStart } })
    if (rows.length) await tx.scheduleBlock.createMany({ data: rows.map((r) => ({ ...r, userId, weekStart })) })
    return tx.scheduleBlock.findMany({ where: { userId, weekStart }, orderBy: { start: 'asc' } })
  })
}

// The week the student's current schedule lives in (latest generated), else this week.
async function latestWeekStart(userId) {
  const latest = await prisma.scheduleBlock.findFirst({
    where: { userId },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  return latest?.weekStart || mondayOf(new Date())
}

export async function generateSchedule(userId, weekStartInput) {
  let weekStart = mondayOf(weekStartInput ? new Date(weekStartInput) : new Date())
  let plan = await planSchedule(weekStart, userId)
  // If the current week is already over (no future free slots), plan next week instead.
  if (!weekStartInput && plan.rows.length === 0) {
    const next = new Date(weekStart)
    next.setUTCDate(next.getUTCDate() + 7)
    const nextPlan = await planSchedule(next, userId)
    if (nextPlan.rows.length > 0) {
      weekStart = next
      plan = nextPlan
    }
  }
  const blocks = await persist(userId, weekStart, plan.rows)
  return { weekStart, source: plan.source, blocks }
}

// Re-plan the week and return a diff (added / removed / kept) vs the current schedule.
export async function rebalanceSchedule(userId, weekStartInput) {
  const weekStart = weekStartInput ? mondayOf(new Date(weekStartInput)) : await latestWeekStart(userId)
  const previous = await prisma.scheduleBlock.findMany({ where: { userId, weekStart } })
  const { source, rows } = await planSchedule(weekStart, userId)

  const keyOf = (b) => `${b.taskId || b.title}@${new Date(b.start).toISOString()}`
  const prevKeys = new Set(previous.map(keyOf))
  const nextKeys = new Set(rows.map(keyOf))
  const shape = (b) => ({ title: b.title, start: b.start, rationale: b.rationale })

  const added = rows.filter((r) => !prevKeys.has(keyOf(r))).map(shape)
  const removed = previous.filter((p) => !nextKeys.has(keyOf(p))).map(shape)

  const blocks = await persist(userId, weekStart, rows)
  return {
    weekStart,
    source,
    diff: { added, removed, kept: rows.length - added.length },
    blocks,
  }
}

export async function getSchedule(userId, weekStartInput) {
  // No week specified → return the student's latest generated schedule.
  const weekStart = weekStartInput ? mondayOf(new Date(weekStartInput)) : await latestWeekStart(userId)
  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId, weekStart },
    orderBy: { start: 'asc' },
  })
  return { weekStart, blocks }
}

function fallbackReflection(stats) {
  const patterns = [
    stats.completionRate >= 70
      ? { emoji: '✅', text: `Strong week — ${stats.completionRate}% of your tasks are complete.` }
      : { emoji: '📉', text: `Completion is at ${stats.completionRate}% — there's room to catch up.` },
    stats.slipped > 0
      ? { emoji: '⏰', text: `${stats.slipped} task${stats.slipped > 1 ? 's' : ''} slipped past the deadline.` }
      : { emoji: '🎯', text: 'Nothing slipped past its deadline — great pacing.' },
    { emoji: '📚', text: `${stats.open} task${stats.open === 1 ? '' : 's'} still open across your courses.` },
  ]
  const suggestions = [
    stats.slipped > 0
      ? { id: 1, text: 'Reschedule the slipped tasks first next week.' }
      : { id: 1, text: 'Front-load high-priority tasks earlier in the week.' },
    { id: 2, text: 'Generate a fresh AI schedule to fit your remaining work.' },
    stats.completionRate < 50
      ? { id: 3, text: 'Break large tasks into smaller 1–2h blocks.' }
      : { id: 3, text: 'Add a buffer to high-effort estimates.' },
  ]
  return { patterns, suggestions }
}

export async function getReflection(userId) {
  const tasks = await prisma.task.findMany({
    where: { course: { userId } },
    include: { course: { select: { code: true } } },
  })
  const now = new Date()
  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'COMPLETE').length
  const slipped = tasks.filter((t) => t.status !== 'COMPLETE' && new Date(t.deadline) < now).length
  const stats = {
    total,
    completed,
    slipped,
    open: tasks.filter((t) => t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS').length,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
  }

  let ai = null
  if (groqEnabled() && total > 0) {
    try {
      const system =
        'You are StudyFlow\'s weekly reflection assistant. Given a student\'s study stats, ' +
        'produce a short, encouraging reflection. Respond with ONLY JSON: ' +
        '{"patterns":[{"emoji":"","text":""}],"suggestions":[{"text":""}]} (max 3 each, concrete).'
      const out = await groqChatJSON(system, JSON.stringify({ stats }))
      const patterns = (out.patterns || []).slice(0, 3).map((p) => ({
        emoji: p.emoji || '📊',
        text: String(p.text || p).slice(0, 160),
      }))
      const suggestions = (out.suggestions || []).slice(0, 3).map((s, i) => ({
        id: i + 1,
        text: String(s.text || s).slice(0, 160),
      }))
      if (patterns.length && suggestions.length) ai = { patterns, suggestions }
    } catch (e) {
      console.error('Groq reflection failed, using fallback:', e.message)
    }
  }

  return { stats, ...(ai || fallbackReflection(stats)) }
}
