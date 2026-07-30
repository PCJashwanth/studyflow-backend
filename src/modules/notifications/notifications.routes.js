import { Router } from 'express'
import * as ctrl from './notifications.controller.js'
import { env } from '../../config/env.js'
import { httpError } from '../../lib/httpError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

// A scheduler calls this, not a logged-in user, so we check a shared secret
// instead of a JWT.
function requireCronSecret(req, res, next) {
  if (!env.CRON_SECRET) return next(httpError('CRON_SECRET is not set on the server', 503))
  if (req.get('x-cron-secret') !== env.CRON_SECRET) return next(httpError('Invalid cron secret', 401))
  next()
}

router.post('/dispatch', requireCronSecret, asyncHandler(ctrl.dispatch))

export default router
