import { z } from 'zod'

export const signupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).default('STUDENT'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Enter the 6-digit code'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Enter the 6-digit code'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})
