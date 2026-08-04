import { z } from 'zod'

export const createAssignmentSchema = z.object({
  code: z.string().min(1, 'Course is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['ASSIGNMENT', 'READING', 'EXAM', 'PRESENTATION', 'PROJECT', 'OTHER']).default('ASSIGNMENT'),
  deadline: z.coerce.date(),
  effortHours: z.number().positive().max(1000).default(2),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
})
