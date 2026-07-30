import { z } from 'zod'

// Enroll: only the catalog course code is needed (title/instructor come from the catalog).
export const createCourseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
})

export const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  instructorName: z.string().optional(),
  creditHours: z.number().int().min(0).max(12).optional(),
})

// A student's request for a new catalog course.
export const courseRequestSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  title: z.string().min(1, 'Title is required'),
  instructorName: z.string().optional(),
  note: z.string().max(500).optional(),
})
