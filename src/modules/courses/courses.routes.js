import { Router } from 'express'
import * as ctrl from './courses.controller.js'
import { createCourseSchema, updateCourseSchema } from './courses.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

// All course management is student-scoped.
router.use(authenticate, requireRole('STUDENT'))

router.get('/', asyncHandler(ctrl.list))
router.post('/', validate(createCourseSchema), asyncHandler(ctrl.create))
router.get('/:id', asyncHandler(ctrl.get))
router.patch('/:id', validate(updateCourseSchema), asyncHandler(ctrl.update))
router.delete('/:id', asyncHandler(ctrl.remove))

export default router
