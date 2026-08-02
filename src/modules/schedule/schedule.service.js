import { prisma } from '../../lib/prisma.js'
import { groqEnabled, groqChatJSON } from '../../integrations/groq.js'
import { DEFAULT_AVAILABILITY } from '../student/student.service.js'

const OPEN = ['NOT_STARTED', 'IN_PROGRESS']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const OVERNIGHT_HOURS = [0, 2, 4] // 00:00–06:00, used only for urgent deadlines
const URGENT_MS = 2 * 24 * 60 * 60 * 1000 // deadline within 2 days = urgent

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

const parseHour = (s) => Math.max(0, Math.min(24, parseInt(String(s).split(':')[0], 10) || 0))

// Split a day's free ranges into study slots of up to 2 hours.
function slotsFromRanges(ranges) {
  const slots = []
  for (const r of ranges || []) {
    let h = parseHour(r.start)
    const end = parseHour(r.end)
    while (end - h >= 1) {
      const hours = Math.min(2, end - h)
      slots.push({ startHour: h, hours })
      h += hours
    }
  }
  return slots
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

  const availability =
    prefs?.availability && typeof prefs.availability === 'object' ? prefs.availability : DEFAULT_AVAILABILITY
  const now = new Date()

  const freeSlots = []
  for (let d = 0; d < 7; d++) {
    for (const s of slotsFromRanges(availability[DAYS[d]])) {
      if (toDates(weekStart, d, s.startHour, s.hours).start < now) continue // no past slots
      freeSlots.push({ day: d, startHour: s.startHour, hours: s.hours })
    }
  }

  // Overnight (00:00–06:00) — only offered for tasks with imminent deadlines.
  const overnightSlots = []
  for (let d = 0; d < 7; d++) {
    for (const h of OVERNIGHT_HOURS) {
      if (toDates(weekStart, d, h, 2).start < now) continue
      overnightSlots.push({ day: d, startHour: h, hours: 2 })
    }
  }

  return {
    tasks,
    freeSlots,
    overnightSlots,
    prefs: {
      maxStudyHours: prefs?.maxStudyHours ?? 6,
      focusTime: prefs?.focusTime ?? 'Evening',
      minBreakMins: prefs?.minBreakMins ?? 15,
    },
  }
}

// Ask Groq to allocate tasks into the student's free slots. Returns raw blocks.
async function generateWithAI(ctx, weekStart) {
  const system =
    'You are StudyFlow, an academic study-planning assistant. You allocate a student\'s ' +
    'outstanding tasks into their available time for one week. Respond with ONLY valid JSON.'
  const user = JSON.stringify({
    weekStartMonday: weekStart.toISOString().slice(0, 10),
    preferences: ctx.prefs,
    freeSlots: ctx.freeSlots,
    overnightSlots: ctx.overnightSlots,
    tasks: ctx.tasks.map((t, i) => ({
      index: i,
      title: t.title,
      course: t.course.code,
      priority: t.priority,
      effortHours: t.effortHours,
      deadline: t.deadline.toISOString().slice(0, 10),
    })),
    outputSpec:
      'Return {"blocks":[{"taskIndex":int,"day":0-6 (0=Mon),"startHour":int matching a slot,' +
      '"hours":1-2,"rationale":"short reason"}]}. Prefer freeSlots and do NOT exceed ' +
      'preferences.maxStudyHours per day using them. Use overnightSlots (00:00–06:00) ONLY for a ' +
      'task whose deadline is within ~2 days that cannot otherwise fit — overnight is a last resort ' +
      'and may exceed the daily max. Prioritize earlier deadlines and higher priority.',
  })
  const out = await groqChatJSON(system, user)
  return Array.isArray(out.blocks) ? out.blocks : []
}

// Deterministic fallback: fill free slots by deadline order (overnight handled separately).
function generateWithRules(ctx) {
  const remaining = ctx.tasks.map((t, i) => ({ index: i, left: t.effortHours, deadline: t.deadline }))
  const perDay = {}
  const raw = []
  for (const slot of [...ctx.freeSlots].sort((a, b) => a.day - b.day || a.startHour - b.startHour)) {
    const cand = remaining.find((r) => r.left > 0)
    if (!cand) break
    if ((perDay[slot.day] || 0) + slot.hours > ctx.prefs.maxStudyHours) continue
    const hours = Math.min(slot.hours, cand.left)
    cand.left -= hours
    perDay[slot.day] = (perDay[slot.day] || 0) + hours
    raw.push({
      taskIndex: cand.index,
      day: slot.day,
      startHour: slot.startHour,
      hours,
      rationale: `Placed before the ${cand.deadline.toISOString().slice(0, 10)} deadline.`,
    })
  }
  return raw
}

const dateStr = (d) => new Date(d).toISOString().slice(0, 10)

// After the main plan, top up urgent tasks (deadline within 2 days) that still have
// uncovered effort by filling unused overnight slots on/before the deadline date.
function addUrgentOvernight(rows, ctx, weekStart) {
  const now = new Date()
  const covered = {}
  const usedKeys = new Set()
  for (const r of rows) {
    covered[r.taskId] = (covered[r.taskId] || 0) + (new Date(r.end) - new Date(r.start)) / 3600000
    const s = new Date(r.start)
    usedKeys.add(`${(s.getUTCDay() + 6) % 7}-${s.getUTCHours()}`)
  }

  const urgent = ctx.tasks
    .map((t) => ({ task: t, left: t.effortHours - (covered[t.id] || 0), deadline: t.deadline }))
    .filter((r) => r.left > 0.01 && new Date(r.deadline) - now <= URGENT_MS)
  if (!urgent.length) return rows

  const extra = []
  for (const slot of [...ctx.overnightSlots].sort((a, b) => a.day - b.day || a.startHour - b.startHour)) {
    const key = `${slot.day}-${slot.startHour}`
    if (usedKeys.has(key)) continue
    const cand = urgent.find((r) => r.left > 0.01)
    if (!cand) break
    const { start, end } = toDates(weekStart, slot.day, slot.startHour, Math.min(slot.hours, cand.left))
    if (dateStr(start) > dateStr(cand.deadline)) continue // slot's date must be on/before the deadline
    cand.left -= (end - start) / 3600000
    usedKeys.add(key)
    extra.push({
      title: `Study: ${cand.task.title}`,
      start,
      end,
      rationale: `Overnight session — the ${dateStr(cand.deadline)} deadline is close and daytime is full.`,
      source: 'AI',
      taskId: cand.task.id,
    })
  }
  return rows.concat(extra)
}

// Validate raw blocks against the candidate slots and turn them into DB rows.
function toRows(rawBlocks, ctx, weekStart, source) {
  const slotMap = new Map()
  for (const s of ctx.freeSlots) slotMap.set(`${s.day}-${s.startHour}`, { hours: s.hours, overnight: false })
  for (const s of ctx.overnightSlots) {
    const k = `${s.day}-${s.startHour}`
    if (!slotMap.has(k)) slotMap.set(k, { hours: s.hours, overnight: true })
  }

  const used = new Set()
  const perDay = {}
  const rows = []
  for (const b of rawBlocks) {
    const ti = Number(b.taskIndex)
    const day = Number(b.day)
    const startHour = Number(b.startHour)
    const key = `${day}-${startHour}`
    if (!Number.isInteger(ti) || ti < 0 || ti >= ctx.tasks.length) continue
    if (!slotMap.has(key) || used.has(key)) continue
    const slot = slotMap.get(key)
    const hours = Math.min(slot.hours, Math.max(1, Number(b.hours) || slot.hours))
    // Regular slots respect the daily cap; overnight (emergency) bypasses it.
    if (!slot.overnight && (perDay[day] || 0) + hours > ctx.prefs.maxStudyHours) continue

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
    used.add(key)
    if (!slot.overnight) perDay[day] = (perDay[day] || 0) + hours
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
  // Guarantee urgent tasks get overnight coverage if regular time was insufficient.
  rows = addUrgentOvernight(rows, ctx, weekStart)
  return { source, rows }
}

function persist(userId, weekStart, rows) {
  return prisma.$transaction(async (tx) => {
    // A student has one active schedule — replace all of their blocks.
    await tx.scheduleBlock.deleteMany({ where: { userId } })
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
