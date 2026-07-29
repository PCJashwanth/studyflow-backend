import * as service from './settings.service.js'

export async function get(req, res) {
  res.json(await service.getSettings(req.user.id))
}

export async function put(req, res) {
  res.json(await service.saveSettings(req.user.id, req.body))
}
