import { z } from 'zod'

export const updateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
})

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
})
