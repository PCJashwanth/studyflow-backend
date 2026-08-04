import { prisma } from '../../lib/prisma.js'
import { httpError } from '../../lib/httpError.js'

const publicSelect = { id: true, fullName: true, email: true, role: true, settings: true }

function shape(u) {
  return { fullName: u.fullName, email: u.email, role: u.role, settings: u.settings || {} }
}

export async function getSettings(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: publicSelect })
  return shape(u)
}

export async function saveSettings(userId, { fullName, email, settings }) {
  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (email !== undefined) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing && existing.id !== userId) throw httpError('Email already in use', 409)
    data.email = email
  }
  if (settings !== undefined) {
    // Merge top-level keys so a partial update never drops other settings.
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } })
    data.settings = { ...(current.settings || {}), ...settings }
  }
  const u = await prisma.user.update({ where: { id: userId }, data, select: publicSelect })
  return shape(u)
}
