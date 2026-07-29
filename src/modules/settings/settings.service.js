import { prisma } from '../../lib/prisma.js'

const publicSelect = { id: true, fullName: true, email: true, role: true, settings: true }

function shape(u) {
  return { fullName: u.fullName, email: u.email, role: u.role, settings: u.settings || {} }
}

export async function getSettings(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: publicSelect })
  return shape(u)
}

export async function saveSettings(userId, { fullName, settings }) {
  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (settings !== undefined) {
    // Merge top-level keys so a partial update never drops other settings.
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } })
    data.settings = { ...(current.settings || {}), ...settings }
  }
  const u = await prisma.user.update({ where: { id: userId }, data, select: publicSelect })
  return shape(u)
}
