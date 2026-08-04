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

export async function createAssignment(req, res) {
  res.status(201).json(await service.createAssignment(req.user.id, req.body))
}
