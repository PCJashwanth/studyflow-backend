import * as service from './instructor.service.js'

export async function dashboard(req, res) {
  res.json(await service.getDashboard(req.user.id))
}

export async function assignments(req, res) {
  res.json(await service.getAssignments(req.user.id))
}

export async function workload(req, res) {
  res.json(await service.getWorkload(req.user.id))
}
