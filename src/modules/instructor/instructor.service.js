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
