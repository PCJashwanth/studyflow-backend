import { Router } from 'express'
import * as ctrl from './student.controller.js'
import { preferencesSchema } from './student.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))
router.get('/dashboard', asyncHandler(ctrl.dashboard))
router.get('/preferences', asyncHandler(ctrl.getPreferences))
router.put('/preferences', validate(preferencesSchema), asyncHandler(ctrl.savePreferences))

export default router
