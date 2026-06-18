import { Router } from 'express'
import * as ctrl from './student.controller.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))
router.get('/dashboard', asyncHandler(ctrl.dashboard))

export default router
