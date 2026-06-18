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
