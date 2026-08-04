import { Router } from 'express'
import * as ctrl from './instructor.controller.js'
import { createAssignmentSchema } from './instructor.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('INSTRUCTOR'))
router.get('/dashboard', asyncHandler(ctrl.dashboard))
router.get('/assignments', asyncHandler(ctrl.assignments))
router.post('/assignments', validate(createAssignmentSchema), asyncHandler(ctrl.createAssignment))
router.get('/workload', asyncHandler(ctrl.workload))

export default router
