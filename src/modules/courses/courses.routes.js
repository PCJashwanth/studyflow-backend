import { Router } from 'express'
import * as ctrl from './courses.controller.js'
import { createCourseSchema, updateCourseSchema } from './courses.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { cacheMiddleware, invalidateCache } from '../../middleware/cache.js'

const router = Router()

// All course management is student-scoped.
router.use(authenticate, requireRole('STUDENT'))

// Course writes also affect task lists (cascade delete / course summaries).
const invalidate = (req, res, next) => {
  invalidateCache('/api/courses', '/api/tasks')
  next()
}

router.get('/', cacheMiddleware(60), asyncHandler(ctrl.list))
router.post('/', invalidate, validate(createCourseSchema), asyncHandler(ctrl.create))
router.get('/:id', asyncHandler(ctrl.get))
router.patch('/:id', invalidate, validate(updateCourseSchema), asyncHandler(ctrl.update))
router.delete('/:id', invalidate, asyncHandler(ctrl.remove))

export default router
