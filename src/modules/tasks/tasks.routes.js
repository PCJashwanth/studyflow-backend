import { Router } from 'express'
import * as ctrl from './tasks.controller.js'
import { createTaskSchema, updateTaskSchema } from './tasks.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))

router.get('/', asyncHandler(ctrl.list))
router.post('/', validate(createTaskSchema), asyncHandler(ctrl.create))
router.get('/:id', asyncHandler(ctrl.get))
router.patch('/:id', validate(updateTaskSchema), asyncHandler(ctrl.update))
router.delete('/:id', asyncHandler(ctrl.remove))

export default router
