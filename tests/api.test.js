// Tests for the parts of StudyFlow that must not break: logging in, keeping
// roles apart, rejecting bad input, and guarding the reminder cron endpoint.

// These run against the real Express app but never reach a service that queries
// the database, so no test database is needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { signToken } from '../src/lib/jwt.js'
import { hashPassword, verifyPassword } from '../src/lib/password.js'
import { updateTaskSchema } from '../src/modules/tasks/tasks.schema.js'

const app = createApp()

const studentToken = signToken({ sub: 'student-1', role: 'STUDENT', email: 's@studyflow.dev' })
const instructorToken = signToken({ sub: 'inst-1', role: 'INSTRUCTOR', email: 'i@studyflow.dev' })

// Authentication

test('a correct password verifies and a wrong one does not', async () => {
  const hash = await hashPassword('Password123!')
  assert.equal(await verifyPassword('Password123!', hash), true)
  assert.equal(await verifyPassword('wrong-password', hash), false)
})

test('a tampered token is rejected', async () => {
  const res = await request(app)
    .get('/api/tasks')
    .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIifQ.bad-signature')
  assert.equal(res.status, 401)
})

test('protected routes cannot be reached without a token', async () => {
  const routes = ['/api/tasks', '/api/courses', '/api/settings', '/api/admin/users']
  for (const route of routes) {
    const res = await request(app).get(route)
    assert.equal(res.status, 401, `${route} should require a token`)
  }
})

// Role-based access control (RBAC)

test('a student cannot reach admin or instructor routes', async () => {
  const admin = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${studentToken}`)
  assert.equal(admin.status, 403)

  const instructor = await request(app)
    .get('/api/instructor/workload')
    .set('Authorization', `Bearer ${studentToken}`)
  assert.equal(instructor.status, 403)
})

test('an instructor cannot reach student or admin routes', async () => {
  const student = await request(app).get('/api/tasks').set('Authorization', `Bearer ${instructorToken}`)
  assert.equal(student.status, 403)

  const admin = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${instructorToken}`)
  assert.equal(admin.status, 403)
})

// Input validation

test('signup rejects a weak password with 400 and says which field', async () => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ fullName: 'A', email: 'a@b.co', password: 'short' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'Validation failed')
  assert.ok(res.body.details.password)
})

test('signup rejects an invalid role, so nobody can sign up as an admin', async () => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ fullName: 'A', email: 'a@b.co', password: 'Password123!', role: 'SUPERUSER' })
  assert.equal(res.status, 400)
})

test('a task update cannot move the task to another course', () => {
  const parsed = updateTaskSchema.safeParse({ title: 'New title', courseId: 'some-other-course' })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.courseId, undefined)
})

// Reminder cron endpoint 

test('the reminder endpoint never dispatches without the right secret', async () => {
  const noSecret = await request(app).post('/api/notifications/dispatch')
  const wrongSecret = await request(app)
    .post('/api/notifications/dispatch')
    .set('x-cron-secret', 'definitely-not-the-secret')

  // 401 when a secret is configured and did not match, 503 when the server has
  // none set. Either way it must not send any email.
  assert.ok([401, 503].includes(noSecret.status), `expected 401 or 503, got ${noSecret.status}`)
  assert.ok([401, 503].includes(wrongSecret.status))
})

// Baseline hardening

test('security headers are set on every response', async () => {
  const res = await request(app).get('/health')
  assert.equal(res.status, 200)
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
  assert.ok(res.headers['content-security-policy'])
})
