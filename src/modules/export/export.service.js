import { prisma } from '../../lib/prisma.js'
import { createEvents } from 'ics'

const EMPTY_ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StudyFlow//EN\r\nEND:VCALENDAR\r\n'

// Builds an .ics calendar from the student's task deadlines (1h event each).
export async function tasksIcs(userId) {
  const tasks = await prisma.task.findMany({
    where: { course: { userId } },
    include: { course: { select: { code: true } } },
    orderBy: { deadline: 'asc' },
  })

  if (tasks.length === 0) return { ics: EMPTY_ICS, count: 0 }

  const events = tasks.map((t) => {
    const d = new Date(t.deadline)
    return {
      title: `${t.course.code}: ${t.title}`,
      start: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()],
      startInputType: 'utc',
      duration: { hours: 1 },
      description: `Priority ${t.priority} · ~${t.effortHours}h`,
    }
  })

  const { error, value } = createEvents(events)
  if (error) throw error
  return { ics: value, count: events.length }
}
