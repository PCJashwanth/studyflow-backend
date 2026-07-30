import { Router } from 'express'
import * as ctrl from './courses.controller.js'
import { createCourseSchema, updateCourseSchema, courseRequestSchema } from './courses.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

// All course management is student-scoped.
router.use(authenticate, requireRole('STUDENT'))

// Static paths must come before the /:id param route.
router.get('/catalog', asyncHandler(ctrl.catalog))
router.get('/requests', asyncHandler(ctrl.listRequests))
router.post('/requests', validate(courseRequestSchema), asyncHandler(ctrl.createRequest))

router.get('/', asyncHandler(ctrl.list))
router.post('/', validate(createCourseSchema), asyncHandler(ctrl.create))
router.get('/:id', asyncHandler(ctrl.get))
router.patch('/:id', validate(updateCourseSchema), asyncHandler(ctrl.update))
router.delete('/:id', asyncHandler(ctrl.remove))

export default router
