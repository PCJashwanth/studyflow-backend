import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import authRoutes from './modules/auth/auth.routes.js'
import courseRoutes from './modules/courses/courses.routes.js'
import taskRoutes from './modules/tasks/tasks.routes.js'
import studentRoutes from './modules/student/student.routes.js'
import instructorRoutes from './modules/instructor/instructor.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
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
  app.use('/api/courses', courseRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/student', studentRoutes)
  app.use('/api/instructor', instructorRoutes)
  app.use('/api/admin', adminRoutes)

  // 404 + central error handler (must be last)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
