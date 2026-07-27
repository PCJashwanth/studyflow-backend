import { Router } from 'express'
import * as ctrl from './tasks.controller.js'
import { createTaskSchema, updateTaskSchema } from './tasks.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { cacheMiddleware, invalidateCache } from '../../middleware/cache.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))

// Task writes change course _count summaries, so invalidate both lists.
const invalidate = (req, res, next) => {
  invalidateCache('/api/tasks', '/api/courses')
  next()
}

router.get('/', cacheMiddleware(60), asyncHandler(ctrl.list))
router.post('/', invalidate, validate(createTaskSchema), asyncHandler(ctrl.create))
router.get('/:id', asyncHandler(ctrl.get))
router.patch('/:id', invalidate, validate(updateTaskSchema), asyncHandler(ctrl.update))
router.delete('/:id', invalidate, asyncHandler(ctrl.remove))

export default router
