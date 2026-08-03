import { z } from 'zod'

export const updateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
})

// Admin-created accounts get their password set here
export const createUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).default('STUDENT'),
})

// Role and status have their own endpoints, so this only covers the profile.
export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
})

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
})

export const createCourseSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  instructorName: z.string().optional(),
  term: z.string().optional(),
})

export const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  instructorName: z.string().optional(),
  term: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

export const decideRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
})

