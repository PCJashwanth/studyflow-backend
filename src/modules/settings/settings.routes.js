import { Router } from 'express'
import * as ctrl from './settings.controller.js'
import { updateSettingsSchema } from './settings.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

// Available to any authenticated user (all three roles have a Settings page).
router.use(authenticate)
router.get('/', asyncHandler(ctrl.get))
router.put('/', validate(updateSettingsSchema), asyncHandler(ctrl.put))

export default router
