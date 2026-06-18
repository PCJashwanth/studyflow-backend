import * as service from './courses.service.js'

export async function list(req, res) {
  res.json({ courses: await service.listCourses(req.user.id) })
}

export async function get(req, res) {
  res.json({ course: await service.getCourse(req.user.id, req.params.id) })
}

export async function create(req, res) {
  res.status(201).json({ course: await service.createCourse(req.user.id, req.body) })
}

export async function update(req, res) {
  res.json({ course: await service.updateCourse(req.user.id, req.params.id, req.body) })
}

export async function remove(req, res) {
  await service.deleteCourse(req.user.id, req.params.id)
  res.status(204).end()
}
