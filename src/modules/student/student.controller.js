import * as service from './student.service.js'

export async function dashboard(req, res) {
  res.json(await service.getDashboard(req.user.id))
}
