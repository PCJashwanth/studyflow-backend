import * as service from './admin.service.js'

export async function listUsers(req, res) {
  const { role, isActive } = req.query
  const filters = {}
  if (role) filters.role = role
  if (isActive === 'true') filters.isActive = true
  if (isActive === 'false') filters.isActive = false
  res.json({ users: await service.listUsers(filters) })
}

export async function createUser(req, res) {
  res.status(201).json({ user: await service.createUser(req.user.id, req.body) })
}

export async function updateUser(req, res) {
  res.json({ user: await service.updateUser(req.user.id, req.params.id, req.body) })
}

export async function updateRole(req, res) {
  res.json({ user: await service.updateRole(req.user.id, req.params.id, req.body.role) })
}

export async function setStatus(req, res) {
  res.json({ user: await service.setStatus(req.user.id, req.params.id, req.body.isActive) })
}

export async function auditLogs(req, res) {
  res.json({ auditLogs: await service.listAuditLogs() })
}

export async function dashboard(req, res) {
  res.json(await service.getDashboard())
}

export async function listCourses(req, res) {
  res.json({ courses: await service.listCourses() })
}

export async function createCourse(req, res) {
  res.status(201).json({ course: await service.createCourse(req.user.id, req.body) })
}

export async function updateCourse(req, res) {
  res.json({ course: await service.updateCourse(req.user.id, req.params.id, req.body) })
}

export async function listCourseRequests(req, res) {
  res.json({ requests: await service.listCourseRequests() })
}

export async function decideCourseRequest(req, res) {
  res.json({ request: await service.decideCourseRequest(req.user.id, req.params.id, req.body.decision) })
}
