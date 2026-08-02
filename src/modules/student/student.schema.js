import { z } from 'zod'

// Legacy grid (still accepted); new form is per-day free time ranges.
const slotState = z.enum(['free', 'class', 'work', 'blocked'])
const timeRange = z.object({ start: z.string(), end: z.string() })

export const preferencesSchema = z.object({
  availabilityGrid: z.array(z.array(slotState)).optional(),
  // { Mon: [{start:"18:00", end:"22:00"}], ... }
  availability: z.record(z.string(), z.array(timeRange)).optional(),
  maxStudyHours: z.number().int().min(1).max(12).optional(),
  focusTime: z.enum(['Morning', 'Evening', 'Late night']).optional(),
  minBreakMins: z.number().int().min(0).max(120).optional(),
  notifyBeforeBlocks: z.boolean().optional(),
})
