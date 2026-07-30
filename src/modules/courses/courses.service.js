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

// Enroll = pick an ACTIVE catalog course by code. No free-typing.
export async function createCourse(userId, { code }) {
  const catalog = await prisma.catalogCourse.findFirst({ where: { code, status: 'ACTIVE' } })
  if (!catalog) throw httpError('That course is not in the catalog — please request it.', 400)
  const existing = await prisma.course.findFirst({ where: { userId, code: catalog.code } })
  if (existing) throw httpError('You are already enrolled in this course', 409)
  return prisma.course.create({
    data: { userId, code: catalog.code, title: catalog.title, instructorName: catalog.instructorName },
  })
}

// The active catalog a student can enroll from.
export function listCatalog() {
  return prisma.catalogCourse.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, title: true, instructorName: true },
  })
}

export function createRequest(userId, data) {
  return prisma.courseRequest.create({ data: { ...data, studentId: userId } })
}

export function listRequests(userId) {
  return prisma.courseRequest.findMany({
    where: { studentId: userId },
    orderBy: { createdAt: 'desc' },
  })
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
