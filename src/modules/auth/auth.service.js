import { prisma } from '../../lib/prisma.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { signToken } from '../../lib/jwt.js'
import { httpError } from '../../lib/httpError.js'

function publicUser(u) {
  return { id: u.id, fullName: u.fullName, email: u.email, role: u.role, createdAt: u.createdAt }
}

function withToken(user) {
  const token = signToken({ sub: user.id, role: user.role, email: user.email })
  return { token, user: publicUser(user) }
}

export async function signup({ fullName, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw httpError('Email already registered', 409)

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { fullName, email, passwordHash, role },
  })
  return withToken(user)
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw httpError('Invalid credentials', 401)

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw httpError('Invalid credentials', 401)

  if (!user.isActive) throw httpError('Account is deactivated', 403)

  return withToken(user)
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw httpError('User not found', 404)
  return publicUser(user)
}
