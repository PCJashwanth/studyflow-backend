import { z } from 'zod'

export const updateSettingsSchema = z.object({
  fullName: z.string().min(1).optional(),
  settings: z.record(z.string(), z.any()).optional(),
})
