import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { signToken } from '../../lib/jwt.js'
import { httpError } from '../../lib/httpError.js'
import { env } from '../../config/env.js'
import { sendEmail } from '../../integrations/resend.js'

const OTP_TTL_MIN = 5
const OTP_MAX_ATTEMPTS = 5

function publicUser(u) {
  return { id: u.id, fullName: u.fullName, email: u.email, role: u.role, createdAt: u.createdAt }
}

// Create a fresh single-use login code, email it, and return the plaintext
// (the caller only exposes it in development for testing).
async function issueLoginOtp(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = await hashPassword(code)

  // Invalidate any previous unconsumed codes for this user.
  await prisma.otpCode.updateMany({
    where: { userId: user.id, purpose: 'LOGIN', consumedAt: null },
    data: { consumedAt: new Date() },
  })
  await prisma.otpCode.create({
    data: { userId: user.id, codeHash, purpose: 'LOGIN', expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
  })

  await sendEmail({
    to: user.email,
    subject: 'Your StudyFlow login code',
    html: `<div style="font-family:sans-serif"><p>Your StudyFlow verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>It expires in ${OTP_TTL_MIN} minutes. If you didn't try to sign in, ignore this email.</p></div>`,
  })

  // Server-side only, never in production and never sent to the browser — lets
  // developers grab the code from the terminal when testing without a real inbox.
  if (env.NODE_ENV !== 'production') {
    console.log(`[otp:dev] login code for ${user.email}: ${code}`)
  }
  return code
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

// Step 1: verify credentials, then email a one-time code (no token yet).
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw httpError('Invalid credentials', 401)

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw httpError('Invalid credentials', 401)

  if (!user.isActive) throw httpError('Account is deactivated', 403)

  await issueLoginOtp(user)
  return { otpRequired: true, email: user.email }
}

// Step 2: verify the emailed code and issue the JWT.
export async function verifyOtp({ email, code }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw httpError('Invalid or expired code', 400)

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: 'LOGIN', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp || otp.expiresAt < new Date()) throw httpError('Code expired — please sign in again', 400)
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    throw httpError('Too many attempts — please sign in again', 400)
  }

  const match = await verifyPassword(code, otp.codeHash)
  if (!match) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    throw httpError('Invalid code', 400)
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
  if (!user.isActive) throw httpError('Account is deactivated', 403)
  return withToken(user)
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw httpError('User not found', 404)
  return publicUser(user)
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw httpError('User not found', 404)

  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) throw httpError('Current password is incorrect', 400)

  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  return { ok: true }
}
