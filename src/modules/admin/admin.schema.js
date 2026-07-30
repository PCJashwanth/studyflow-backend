import { z } from 'zod'

export const updateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
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

