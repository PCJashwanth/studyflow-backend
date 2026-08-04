import { prisma } from '../../lib/prisma.js'
import { httpError } from '../../lib/httpError.js'

const round1 = (n) => Math.round(n * 10) / 10

// Monday (UTC) of the week containing `d`, as YYYY-MM-DD.
function weekStart(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

// Catalog courses this instructor is assigned to teach.
function assignedCourses(instructorId) {
  return prisma.catalogCourse.findMany({
    where: { instructorId },
    select: { code: true, title: true },
    orderBy: { code: 'asc' },
  })
}

// Enrolled students' course rows (with their tasks) for the given course codes.
async function enrolledFor(codes) {
  if (!codes.length) return []
  return prisma.course.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      userId: true,
      tasks: { select: { title: true, effortHours: true, status: true, deadline: true } },
    },
  })
}

// Aggregated, anonymized analytics across the instructor's assigned courses.
export async function getDashboard(instructorId) {
  const courses = await assignedCourses(instructorId)
  const codes = courses.map((c) => c.code)
  const enrolled = await enrolledFor(codes)

  const byCode = new Map(courses.map((c) => [c.code, { code: c.code, title: c.title, students: new Set(), tasks: [] }]))
  for (const e of enrolled) {
    const g = byCode.get(e.code)
    if (!g) continue
    g.students.add(e.userId)
    g.tasks.push(...e.tasks)
  }

  let totalEstimatedHours = 0
  let totalTasks = 0
  let completedTasks = 0
  const statusBreakdown = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETE: 0, SKIPPED: 0 }
  const assignmentMap = new Map()
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

  return {
    courseCount: courseSummaries.length,
    totalEstimatedHours: round1(totalEstimatedHours),
    overallCompletionRate: totalTasks ? round1((completedTasks / totalTasks) * 100) : 0,
    statusBreakdown,
    courses: courseSummaries,
    assignmentsByEffort,
  }
}

// The instructor's created assignments, grouped by course, with completion %.
export async function getAssignments(instructorId) {
  const courses = await assignedCourses(instructorId)
  const codes = courses.map((c) => c.code)
  const [assignments, enrolled] = await Promise.all([
    prisma.assignment.findMany({
      where: { instructorId },
      orderBy: { deadline: 'asc' },
      include: { tasks: { select: { status: true } } },
    }),
    enrolledFor(codes),
  ])

  const studentsByCode = {}
  for (const e of enrolled) studentsByCode[e.code] = (studentsByCode[e.code] || new Set()).add(e.userId)

  const now = new Date()
  const byCourse = {}
  for (const c of courses) byCourse[c.code] = { note: `0 assignments · ${studentsByCode[c.code]?.size || 0} students`, rows: [] }

  for (const a of assignments) {
    if (!byCourse[a.code]) byCourse[a.code] = { note: '', rows: [] }
    const total = a.tasks.length
    const complete = a.tasks.filter((t) => t.status === 'COMPLETE').length
    const past = new Date(a.deadline) < now
    byCourse[a.code].rows.push({
      id: a.id,
      name: a.title,
      due: new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      hours: a.effortHours,
      avgCompletion: total ? Math.round((complete / total) * 100) : null,
      onTime: null,
      status: past ? 'Closed' : 'Open',
      warning: null,
    })
  }
  for (const c of courses) {
    byCourse[c.code].note = `${byCourse[c.code].rows.length} assignments · ${studentsByCode[c.code]?.size || 0} students`
  }

  return { courses: courses.map((c) => c.code), byCourse }
}

// Per-course weekly study-load bars (sum of enrolled students' task effort by week).
export async function getWorkload(instructorId) {
  const courses = await assignedCourses(instructorId)
  const codes = courses.map((c) => c.code)
  const enrolled = await enrolledFor(codes)

  const tasksByCode = new Map(codes.map((c) => [c, []]))
  for (const e of enrolled) {
    const arr = tasksByCode.get(e.code)
    if (arr) arr.push(...e.tasks)
  }

  const byCourse = {}
  for (const c of courses) {
    const tasks = tasksByCode.get(c.code) || []
    const weekMap = new Map()
    for (const t of tasks) {
      const wk = weekStart(new Date(t.deadline))
      weekMap.set(wk, (weekMap.get(wk) || 0) + t.effortHours)
    }
    const sorted = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const weeks = sorted.map(([, hours], i) => ({ label: `W${i + 1}`, hours: round1(hours), marker: null, peak: false }))
    const hoursList = weeks.map((w) => w.hours)
    const peak = hoursList.length ? Math.max(...hoursList) : 0
    weeks.forEach((w) => { if (w.hours === peak) w.peak = true })
    const termAverage = weeks.length ? round1(hoursList.reduce((a, b) => a + b, 0) / weeks.length) : 0
    byCourse[c.code] = {
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
  return { courses: courses.map((c) => c.code), byCourse }
}

// Create an assignment and fan it out as a task to every enrolled student.
export async function createAssignment(instructorId, data) {
  const assigned = await prisma.catalogCourse.findFirst({ where: { code: data.code, instructorId } })
  if (!assigned) throw httpError('You are not assigned to this course', 403)

  const assignment = await prisma.assignment.create({ data: { ...data, instructorId } })

  const courses = await prisma.course.findMany({ where: { code: data.code }, select: { id: true } })
  if (courses.length) {
    await prisma.task.createMany({
      data: courses.map((c) => ({
        courseId: c.id,
        assignmentId: assignment.id,
        title: assignment.title,
        type: assignment.type,
        deadline: assignment.deadline,
        effortHours: assignment.effortHours,
        priority: assignment.priority,
        status: 'NOT_STARTED',
      })),
    })
  }
  return { assignment, fannedOutTo: courses.length }
}
