import * as service from './student.service.js'

export async function dashboard(req, res) {
  res.json(await service.getDashboard(req.user.id))
}

export async function getPreferences(req, res) {
  res.json({ preferences: await service.getPreferences(req.user.id) })
}

export async function savePreferences(req, res) {
  res.json({ preferences: await service.savePreferences(req.user.id, req.body) })
}
