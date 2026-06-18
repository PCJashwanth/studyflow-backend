import { z } from 'zod'

export const taskType = z.enum(['ASSIGNMENT', 'READING', 'EXAM', 'PRESENTATION', 'PROJECT', 'OTHER'])
export const priority = z.enum(['LOW', 'MEDIUM', 'HIGH'])
export const taskStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'SKIPPED'])

export const createTaskSchema = z.object({
  courseId: z.string().uuid('courseId must be a valid id'),
  title: z.string().min(1, 'Title is required'),
  type: taskType.default('ASSIGNMENT'),
  deadline: z.coerce.date(),
  effortHours: z.number().positive().max(1000).default(1),
  priority: priority.default('MEDIUM'),
  status: taskStatus.default('NOT_STARTED'),
})

// Update cannot move a task to another course; everything else is optional.
export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  type: taskType.optional(),
  deadline: z.coerce.date().optional(),
  effortHours: z.number().positive().max(1000).optional(),
  priority: priority.optional(),
  status: taskStatus.optional(),
})

// Query filters for GET /api/tasks
export const taskQuerySchema = z.object({
  courseId: z.string().uuid().optional(),
  status: taskStatus.optional(),
  priority: priority.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
