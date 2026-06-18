import * as service from './tasks.service.js'
import { taskQuerySchema } from './tasks.schema.js'

export async function list(req, res) {
  const filters = taskQuerySchema.parse(req.query)
  res.json({ tasks: await service.listTasks(req.user.id, filters) })
}

export async function get(req, res) {
  res.json({ task: await service.getTask(req.user.id, req.params.id) })
}

export async function create(req, res) {
  res.status(201).json({ task: await service.createTask(req.user.id, req.body) })
}

export async function update(req, res) {
  res.json({ task: await service.updateTask(req.user.id, req.params.id, req.body) })
}

export async function remove(req, res) {
  await service.deleteTask(req.user.id, req.params.id)
  res.status(204).end()
}
