import { prisma } from '../../lib/prisma.js'
import { httpError } from '../../lib/httpError.js'

export function listCourses(userId) {
  return prisma.course.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tasks: true } } },
  })
}

export async function getCourse(userId, id) {
  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: { tasks: { orderBy: { deadline: 'asc' } } },
  })
  if (!course) throw httpError('Course not found', 404)
  return course
}

export function createCourse(userId, data) {
  return prisma.course.create({ data: { ...data, userId } })
}

export async function updateCourse(userId, id, data) {
  await assertOwned(userId, id)
  return prisma.course.update({ where: { id }, data })
}

export async function deleteCourse(userId, id) {
  await assertOwned(userId, id)
  await prisma.course.delete({ where: { id } }) // cascades to tasks
}

async function assertOwned(userId, id) {
  const course = await prisma.course.findFirst({ where: { id, userId }, select: { id: true } })
  if (!course) throw httpError('Course not found', 404)
}
