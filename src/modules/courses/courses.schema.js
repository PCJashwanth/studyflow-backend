import { z } from 'zod'

export const createCourseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  title: z.string().min(1, 'Title is required'),
  instructorName: z.string().optional(),
  creditHours: z.number().int().min(0).max(12).optional(),
})

export const updateCourseSchema = createCourseSchema.partial()
