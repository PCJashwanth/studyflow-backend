import { prisma } from '../../lib/prisma.js'

// Monday (UTC) of the week containing `d`, as YYYY-MM-DD.
function weekStart(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (date.getUTCDay() + 6) % 7 // 0 = Monday
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

const round1 = (n) => Math.round(n * 10) / 10

// Aggregated, anonymized analytics for the courses this instructor teaches.
// No student identity is ever returned.
export async function getDashboard(instructorId) {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    select: {
      id: true,
      code: true,
      title: true,
      userId: true, // used only to count distinct students; never returned
      tasks: { select: { title: true, effortHours: true, status: true, deadline: true } },
    },
  })

  // Group courses by code (multiple students -> multiple course rows, same code).
  const byCode = new Map()
  for (const c of courses) {
    if (!byCode.has(c.code)) {
      byCode.set(c.code, { code: c.code, title: c.title, students: new Set(), tasks: [] })
    }
    const g = byCode.get(c.code)
    g.students.add(c.userId)
    g.tasks.push(...c.tasks)
  }

  let totalEstimatedHours = 0
  let totalTasks = 0
  let completedTasks = 0
  const statusBreakdown = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETE: 0, SKIPPED: 0 }
  const assignmentMap = new Map() // title|code -> { title, code, totalEffortHours, count }
  const weekMap = new Map() // weekStart -> { taskCount, effortHours }

  const courseSummaries = []

  for (const g of byCode.values()) {
    let courseEffort = 0
    let courseComplete = 0
    for (const t of g.tasks) {
      totalEstimatedHours += t.effortHours
      courseEffort += t.effortHours
      totalTasks++
      statusBreakdown[t.status]++
      if (t.status === 'COMPLETE') {
        completedTasks++
        courseComplete++
      }

      const key = `${g.code}::${t.title}`
      const a = assignmentMap.get(key) || { title: t.title, code: g.code, totalEffortHours: 0, count: 0 }
      a.totalEffortHours += t.effortHours
      a.count++
      assignmentMap.set(key, a)

      const wk = weekStart(t.deadline)
      const w = weekMap.get(wk) || { weekStart: wk, taskCount: 0, effortHours: 0 }
      w.taskCount++
      w.effortHours += t.effortHours
      weekMap.set(wk, w)
    }

    courseSummaries.push({
      code: g.code,
      title: g.title,
      studentCount: g.students.size,
      totalTasks: g.tasks.length,
      totalEffortHours: round1(courseEffort),
      completionRate: g.tasks.length ? round1((courseComplete / g.tasks.length) * 100) : 0,
    })
  }

  const assignmentsByEffort = [...assignmentMap.values()]
    .map((a) => ({ ...a, totalEffortHours: round1(a.totalEffortHours) }))
    .sort((a, b) => b.totalEffortHours - a.totalEffortHours)
    .slice(0, 10)

  const deadlinePressure = [...weekMap.values()]
    .map((w) => ({ ...w, effortHours: round1(w.effortHours) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  return {
    courseCount: courseSummaries.length,
    totalEstimatedHours: round1(totalEstimatedHours),
    overallCompletionRate: totalTasks ? round1((completedTasks / totalTasks) * 100) : 0,
    statusBreakdown,
    courses: courseSummaries,
    assignmentsByEffort,
    deadlinePressure,
  }
}

// Loads this instructor's courses' tasks, grouped by course code.
async function courseTasks(instructorId) {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    select: {
      code: true,
      title: true,
      tasks: { select: { title: true, deadline: true, effortHours: true, status: true } },
    },
  })
  const byCode = new Map()
  for (const c of courses) {
    if (!byCode.has(c.code)) byCode.set(c.code, { code: c.code, title: c.title, tasks: [] })
    byCode.get(c.code).tasks.push(...c.tasks)
  }
  return byCode
}

// Per-course assignment table: anonymized completion aggregated across students.
export async function getAssignments(instructorId) {
  const byCode = await courseTasks(instructorId)
  const now = new Date()
  const byCourse = {}

  for (const group of byCode.values()) {
    const assignmentMap = new Map()
    for (const t of group.tasks) {
      const a = assignmentMap.get(t.title) || {
        name: t.title,
        deadline: t.deadline,
        hours: t.effortHours,
        total: 0,
        complete: 0,
      }
      a.total++
      if (t.status === 'COMPLETE') a.complete++
      if (new Date(t.deadline) < new Date(a.deadline)) a.deadline = t.deadline
      assignmentMap.set(t.title, a)
    }

    const rows = [...assignmentMap.values()]
      .sort((x, y) => new Date(x.deadline) - new Date(y.deadline))
      .map((a, i) => {
        const avgCompletion = a.total ? Math.round((a.complete / a.total) * 100) : null
        const past = new Date(a.deadline) < now
        const soon = !past && new Date(a.deadline) - now < 7 * 24 * 60 * 60 * 1000
        return {
          id: `${group.code}-${i}`,
          name: a.name,
          due: new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hours: a.hours,
          avgCompletion,
          onTime: null, // needs completion timestamps (CompletionLog) — future
          status: past ? 'Closed' : 'Open',
          warning: soon && avgCompletion !== null && avgCompletion < 50
            ? 'Low completion ahead of deadline'
            : null,
        }
      })

    byCourse[group.code] = { note: `${rows.length} assessments · anonymized aggregate`, rows }
  }

  return { courses: [...byCode.keys()], byCourse }
}

// Per-course weekly study-load bars (sum of task effort bucketed by deadline week).
export async function getWorkload(instructorId) {
  const byCode = await courseTasks(instructorId)
  const byCourse = {}

  for (const group of byCode.values()) {
    const weekMap = new Map()
    for (const t of group.tasks) {
      const wk = weekStart(new Date(t.deadline))
      weekMap.set(wk, (weekMap.get(wk) || 0) + t.effortHours)
    }
    const sorted = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const weeks = sorted.map(([, hours], i) => ({
      label: `W${i + 1}`,
      hours: round1(hours),
      marker: null,
      peak: false,
    }))
    const hoursList = weeks.map((w) => w.hours)
    const peak = hoursList.length ? Math.max(...hoursList) : 0
    weeks.forEach((w) => { if (w.hours === peak) w.peak = true })
    const termAverage = weeks.length ? round1(hoursList.reduce((a, b) => a + b, 0) / weeks.length) : 0

    byCourse[group.code] = {
      weeks,
      heaviestWeek: weeks.find((w) => w.peak)?.label || '—',
      heaviestNote: 'Heaviest week',
      peakLoad: peak,
      termAverage,
      recommendedMax: round1(peak * 0.8) || 10,
      insight: peak > 0
        ? `Peak load of ${peak}h — consider spreading deadlines around ${weeks.find((w) => w.peak)?.label}.`
        : 'No workload data yet.',
    }
  }

  return { courses: [...byCode.keys()], byCourse }
}
