import { Router } from 'express'
import * as ctrl from './auth.controller.js'
import {
  signupSchema,
  loginSchema,
  changePasswordSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js'
import { validate } from '../../middleware/validate.js'
import { authenticate } from '../../middleware/auth.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.post('/signup', validate(signupSchema), asyncHandler(ctrl.signup))
router.post('/login', validate(loginSchema), asyncHandler(ctrl.login))
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(ctrl.verifyOtp))
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(ctrl.forgotPassword))
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(ctrl.resetPassword))
router.get('/me', authenticate, asyncHandler(ctrl.me))
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(ctrl.changePassword))

export default router
