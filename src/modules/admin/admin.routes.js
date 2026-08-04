import { Router } from 'express'
import * as ctrl from './admin.controller.js'
import {
  createUserSchema,
  updateUserSchema,
  updateRoleSchema,
  updateStatusSchema,
  createCourseSchema,
  updateCourseSchema,
  decideRequestSchema,
} from './admin.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('ADMIN'))

router.get('/dashboard', asyncHandler(ctrl.dashboard))
router.get('/users', asyncHandler(ctrl.listUsers))
router.post('/users', validate(createUserSchema), asyncHandler(ctrl.createUser))
router.patch('/users/:id', validate(updateUserSchema), asyncHandler(ctrl.updateUser))
router.patch('/users/:id/role', validate(updateRoleSchema), asyncHandler(ctrl.updateRole))
router.patch('/users/:id/status', validate(updateStatusSchema), asyncHandler(ctrl.setStatus))
router.get('/audit-logs', asyncHandler(ctrl.auditLogs))

router.get('/instructors', asyncHandler(ctrl.listInstructors))
router.get('/courses', asyncHandler(ctrl.listCourses))
router.post('/courses', validate(createCourseSchema), asyncHandler(ctrl.createCourse))
router.patch('/courses/:id', validate(updateCourseSchema), asyncHandler(ctrl.updateCourse))

router.get('/course-requests', asyncHandler(ctrl.listCourseRequests))
router.patch('/course-requests/:id', validate(decideRequestSchema), asyncHandler(ctrl.decideCourseRequest))

export default router
