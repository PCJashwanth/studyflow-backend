import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { sendEmail, mailerMode } from '../../lib/mailer.js'

function emailBody(name, task, when, hoursLeft) {
  return [
    `Hi ${name},`,
    '',
    `"${task.title}" (${task.course.code}) is due ${when} — about ${hoursLeft} hours from now.`,
    `Estimated effort: ${task.effortHours}h · Priority: ${task.priority}`,
    '',
    'Open StudyFlow to plan time for it.',
  ].join('\n')
}

// Emails students about tasks due soon. Safe to run over and over: each task is
// marked once emailed, so nobody gets the same reminder twice.
export async function dispatchDeadlineReminders() {
  const now = new Date()
  const cutoff = new Date(now.getTime() + env.REMINDER_LEAD_HOURS * 3600 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      reminderSentAt: null,
      deadline: { gt: now, lte: cutoff },
      status: { notIn: ['COMPLETE', 'SKIPPED'] },
    },
    include: { course: { include: { user: true } } },
    orderBy: { deadline: 'asc' },
  })

  const result = { mode: mailerMode(), considered: tasks.length, sent: 0, skipped: 0, failed: 0 }

  for (const task of tasks) {
    const student = task.course.user
    // No toggle saved yet means they're opted in, same as the Settings page.
    const wantsEmail = student?.settings?.notifications?.deadline !== false

    if (!student?.email || !wantsEmail) {
      result.skipped++
      continue
    }

    const hoursLeft = Math.max(1, Math.round((task.deadline - now) / 3600000))
    const when = task.deadline.toLocaleString('en-CA', {
      timeZone: 'America/Halifax',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    try {
      await sendEmail({
        to: student.email,
        subject: `Due in ${hoursLeft}h: ${task.title}`,
        text: emailBody(student.fullName, task, when, hoursLeft),
      })
      // Mark it only after a successful send, so failures retry next run.
      await prisma.task.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } })
      result.sent++
    } catch (err) {
      console.error(`Reminder failed for "${task.title}":`, err.message)
      result.failed++
    }
  }

  return result
}
