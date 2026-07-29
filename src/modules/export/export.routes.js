import { Router } from 'express'
import * as ctrl from './export.controller.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))
router.get('/schedule.ics', asyncHandler(ctrl.scheduleIcs))

export default router
