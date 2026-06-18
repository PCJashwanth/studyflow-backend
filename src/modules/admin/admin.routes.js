import { Router } from 'express'
import * as ctrl from './admin.controller.js'
import { updateRoleSchema, updateStatusSchema } from './admin.schema.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('ADMIN'))

router.get('/dashboard', asyncHandler(ctrl.dashboard))
router.get('/users', asyncHandler(ctrl.listUsers))
router.patch('/users/:id/role', validate(updateRoleSchema), asyncHandler(ctrl.updateRole))
router.patch('/users/:id/status', validate(updateStatusSchema), asyncHandler(ctrl.setStatus))
router.get('/audit-logs', asyncHandler(ctrl.auditLogs))

export default router
