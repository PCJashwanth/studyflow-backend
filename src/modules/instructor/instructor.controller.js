import * as service from './instructor.service.js'

export async function dashboard(req, res) {
  res.json(await service.getDashboard(req.user.id))
}
