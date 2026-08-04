import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // Email (Resend). One key drives both mailers; with no key, emails are logged.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('StudyFlow <onboarding@resend.dev>'), // reminder mailer (lib/mailer.js)
  RESEND_FROM: z.string().default('StudyFlow <onboarding@resend.dev>'), // OTP mailer (integrations/resend.js)
  CRON_SECRET: z.string().optional(), // secret the scheduler sends
  REMINDER_LEAD_HOURS: z.coerce.number().default(24), // how early to remind

  // AI (optional — a rule-based fallback runs if the key is absent or Groq fails).
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
