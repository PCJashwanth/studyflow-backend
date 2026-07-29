import { z } from 'zod'

// The availability grid is a flexible 2D array of slot-state strings.
const slotState = z.enum(['free', 'class', 'work', 'blocked'])

export const preferencesSchema = z.object({
  availabilityGrid: z.array(z.array(slotState)).optional(),
  maxStudyHours: z.number().int().min(1).max(12).optional(),
  focusTime: z.enum(['Morning', 'Evening', 'Late night']).optional(),
  minBreakMins: z.number().int().min(0).max(120).optional(),
  notifyBeforeBlocks: z.boolean().optional(),
})
