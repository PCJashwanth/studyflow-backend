import { prisma } from '../../lib/prisma.js'

const OPEN = ['NOT_STARTED', 'IN_PROGRESS'] // incomplete statuses

const DEFAULT_PREFERENCES = {
  availabilityGrid: null,
  maxStudyHours: 6,
  focusTime: 'Evening',
  minBreakMins: 15,
  notifyBeforeBlocks: true,
}

// Returns the student's saved preferences, or sensible defaults if none yet.
export async function getPreferences(userId) {
  const prefs = await prisma.studentPreferences.findUnique({ where: { userId } })
  if (!prefs) return DEFAULT_PREFERENCES
  return {
    availabilityGrid: prefs.availabilityGrid,
    maxStudyHours: prefs.maxStudyHours,
    focusTime: prefs.focusTime,
    minBreakMins: prefs.minBreakMins,
    notifyBeforeBlocks: prefs.notifyBeforeBlocks,
  }
}

// Upsert: create the row on first save, update it thereafter.
export async function savePreferences(userId, data) {
  const prefs = await prisma.studentPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data },
  })
  return {
    availabilityGrid: prefs.availabilityGrid,
    maxStudyHours: prefs.maxStudyHours,
    focusTime: prefs.focusTime,
    minBreakMins: prefs.minBreakMins,
    notifyBeforeBlocks: prefs.notifyBeforeBlocks,
  }
}

export async function getDashboard(userId) {
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [courseCount, tasks] = await Promise.all([
    prisma.course.count({ where: { userId } }),
    prisma.task.findMany({
      where: { course: { userId } },
      include: { course: { select: { id: true, code: true, title: true } } },
      orderBy: { deadline: 'asc' },
    }),
  ])

  const byStatus = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETE: 0, SKIPPED: 0 }
  const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0 }
  let effortRemaining = 0

  for (const t of tasks) {
    byStatus[t.status]++
    byPriority[t.priority]++
    if (OPEN.includes(t.status)) effortRemaining += t.effortHours
  }

  const open = tasks.filter((t) => OPEN.includes(t.status))
  const overdue = open.filter((t) => t.deadline < now)
  const upcoming = open.filter((t) => t.deadline >= now && t.deadline <= weekAhead)

  return {
    counts: {
      courses: courseCount,
      tasks: tasks.length,
      byStatus,
      byPriority,
    },
    effortRemainingHours: Math.round(effortRemaining * 10) / 10,
    overdue: overdue.slice(0, 10),
    upcomingThisWeek: upcoming.slice(0, 10),
    nextDeadlines: open.slice(0, 5),
  }
}
