import * as service from './schedule.service.js'

export async function generate(req, res) {
  res.json(await service.generateSchedule(req.user.id, req.body?.weekStart))
}

export async function rebalance(req, res) {
  res.json(await service.rebalanceSchedule(req.user.id, req.body?.weekStart))
}

export async function list(req, res) {
  res.json(await service.getSchedule(req.user.id, req.query?.weekStart))
}

export async function reflection(req, res) {
  res.json(await service.getReflection(req.user.id))
}
