import { Router } from 'express'
import * as ctrl from './schedule.controller.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

router.use(authenticate, requireRole('STUDENT'))
router.get('/', asyncHandler(ctrl.list))
router.get('/reflection', asyncHandler(ctrl.reflection))
router.post('/generate', asyncHandler(ctrl.generate))
router.post('/rebalance', asyncHandler(ctrl.rebalance))

export default router
