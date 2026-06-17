import { Router } from 'express'
import * as ctrl from './auth.controller.js'
import { signupSchema, loginSchema } from './auth.schema.js'
import { validate } from '../../middleware/validate.js'
import { authenticate } from '../../middleware/auth.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.post('/signup', validate(signupSchema), asyncHandler(ctrl.signup))
router.post('/login', validate(loginSchema), asyncHandler(ctrl.login))
router.get('/me', authenticate, asyncHandler(ctrl.me))

export default router
