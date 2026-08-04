import { prisma } from '../../lib/prisma.js'
import { httpError } from '../../lib/httpError.js'

const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
}

function writeAudit(actorId, action, targetId, meta) {
  return prisma.auditLog.create({
    data: { actorId, action, targetType: 'User', targetId, meta },
  })
}

// ---- Course catalog ----

const courseInstructor = { include: { instructor: { select: { id: true, fullName: true } } } }

export function listInstructors() {
  return prisma.user.findMany({
    where: { role: 'INSTRUCTOR', isActive: true },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  })
}

// List catalog courses, with a derived enrollment count per code (how many
// students have that course code in their personal course list).
export async function listCourses() {
  const [courses, grouped] = await Promise.all([
    prisma.catalogCourse.findMany({ orderBy: { createdAt: 'desc' }, ...courseInstructor }),
    prisma.course.groupBy({ by: ['code'], _count: { _all: true } }),
  ])
  const countByCode = Object.fromEntries(grouped.map((g) => [g.code, g._count._all]))
  return courses.map((c) => ({ ...c, students: countByCode[c.code] || 0 }))
}

// Look up an instructor's name to keep the display field in sync with the link.
async function withInstructorName(data) {
  const out = { ...data }
  if (data.instructorId) {
    const instr = await prisma.user.findFirst({ where: { id: data.instructorId, role: 'INSTRUCTOR' }, select: { fullName: true } })
    if (!instr) throw httpError('Instructor not found', 400)
    out.instructorName = instr.fullName
  } else if (data.instructorId === null) {
    out.instructorName = null
  }
  return out
}

export async function createCourse(actorId, data) {
  const existing = await prisma.catalogCourse.findUnique({ where: { code: data.code } })
  if (existing) throw httpError('A course with this code already exists', 409)
  const course = await prisma.catalogCourse.create({ data: await withInstructorName(data), ...courseInstructor })
  await prisma.auditLog.create({
    data: { actorId, action: 'COURSE_CREATED', targetType: 'Course', targetId: course.id, meta: { code: course.code } },
  })
  return { ...course, students: 0 }
}

export async function updateCourse(actorId, id, data) {
  const existing = await prisma.catalogCourse.findUnique({ where: { id } })
  if (!existing) throw httpError('Course not found', 404)
  const course = await prisma.catalogCourse.update({ where: { id }, data: await withInstructorName(data), ...courseInstructor })
  if (data.status && data.status !== existing.status) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: data.status === 'ARCHIVED' ? 'COURSE_ARCHIVED' : 'COURSE_RESTORED',
        targetType: 'Course',
        targetId: id,
        meta: { code: course.code },
      },
    })
  }
  const count = await prisma.course.count({ where: { code: course.code } })
  return { ...course, students: count }
}

// ---- Course requests ----

const requestWithStudent = {
  include: { student: { select: { id: true, fullName: true, email: true } } },
}

export function listCourseRequests() {
  return prisma.courseRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    ...requestWithStudent,
  })
}

// Approve: add the course to the catalog (if missing) and enroll the requester.
export async function decideCourseRequest(actorId, id, decision) {
  const request = await prisma.courseRequest.findUnique({ where: { id } })
  if (!request) throw httpError('Request not found', 404)
  if (request.status !== 'PENDING') throw httpError('This request has already been decided', 400)

  if (decision === 'APPROVED') {
    const catalog = await prisma.catalogCourse.upsert({
      where: { code: request.code },
      update: { status: 'ACTIVE' },
      create: { code: request.code, title: request.title, instructorName: request.instructorName },
    })
    const already = await prisma.course.findFirst({
      where: { userId: request.studentId, code: catalog.code },
      select: { id: true },
    })
    if (!already) {
      await prisma.course.create({
        data: {
          userId: request.studentId,
          code: catalog.code,
          title: catalog.title,
          instructorName: catalog.instructorName,
        },
      })
    }
  }

  const updated = await prisma.courseRequest.update({
    where: { id },
    data: { status: decision, decidedById: actorId },
    ...requestWithStudent,
  })
  await prisma.auditLog.create({
    data: {
      actorId,
      action: decision === 'APPROVED' ? 'COURSE_REQUEST_APPROVED' : 'COURSE_REQUEST_REJECTED',
      targetType: 'CourseRequest',
      targetId: id,
      meta: { code: request.code },
    },
  })
  return updated
}

export function listUsers({ role, isActive } = {}) {
  const where = {}
  if (role) where.role = role
  if (typeof isActive === 'boolean') where.isActive = isActive
  return prisma.user.findMany({
    where,
    select: publicUserSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateRole(adminId, targetId, role) {
  if (adminId === targetId) throw httpError('You cannot change your own role', 400)
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw httpError('User not found', 404)

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: publicUserSelect,
  })
  await writeAudit(adminId, 'ROLE_CHANGED', targetId, { from: user.role, to: role })
  return updated
}

export async function setStatus(adminId, targetId, isActive) {
  if (adminId === targetId) throw httpError('You cannot change your own status', 400)
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw httpError('User not found', 404)

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive },
    select: publicUserSelect,
  })
  await writeAudit(adminId, isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED', targetId, null)
  return updated
}

export function listAuditLogs(limit = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { id: true, fullName: true, email: true } } },
  })
}

export async function getDashboard() {
  const [usersByRole, activeCount, totalUsers, courseCount, taskCount, recentSignups, recentAudits] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.course.count(),
      prisma.task.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: publicUserSelect,
      }),
      listAuditLogs(5),
    ])

  const byRole = { STUDENT: 0, INSTRUCTOR: 0, ADMIN: 0 }
  for (const r of usersByRole) byRole[r.role] = r._count._all

  return {
    totals: {
      users: totalUsers,
      activeUsers: activeCount,
      inactiveUsers: totalUsers - activeCount,
      byRole,
      courses: courseCount,
      tasks: taskCount,
    },
    recentSignups,
    recentAuditLogs: recentAudits,
  }
}
