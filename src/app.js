import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import authRoutes from './modules/auth/auth.routes.js'
import { notFound, errorHandler } from './middleware/error.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json())
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'))

  // Health check (used by Render + UptimeRobot pinger)
  app.get('/health', (req, res) =>
    res.json({ status: 'ok', service: 'studyflow-backend', time: new Date().toISOString() })
  )

  // Feature modules
  app.use('/api/auth', authRoutes)

  // 404 + central error handler (must be last)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
