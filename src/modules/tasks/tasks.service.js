import { prisma } from '../../lib/prisma.js'
import { httpError } from '../../lib/httpError.js'

const courseSummary = { select: { id: true, code: true, title: true } }

export function listTasks(userId, filters = {}) {
  const where = { course: { userId } }
  if (filters.courseId) where.courseId = filters.courseId
  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.from || filters.to) {
    where.deadline = {}
    if (filters.from) where.deadline.gte = filters.from
    if (filters.to) where.deadline.lte = filters.to
  }
  return prisma.task.findMany({
    where,
    orderBy: { deadline: 'asc' },
    include: { course: courseSummary },
  })
}

export async function getTask(userId, id) {
  const task = await prisma.task.findFirst({
    where: { id, course: { userId } },
    include: { course: courseSummary },
  })
  if (!task) throw httpError('Task not found', 404)
  return task
}

export async function createTask(userId, data) {
  // Ensure the target course belongs to this student.
  const owns = await prisma.course.findFirst({
    where: { id: data.courseId, userId },
    select: { id: true },
  })
  if (!owns) throw httpError('Course not found', 404)

  return prisma.task.create({ data, include: { course: courseSummary } })
}

export async function updateTask(userId, id, data) {
  await getTask(userId, id)
  return prisma.task.update({ where: { id }, data, include: { course: courseSummary } })
}

export async function deleteTask(userId, id) {
  await getTask(userId, id)
  await prisma.task.delete({ where: { id } })
}
