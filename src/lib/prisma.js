import { PrismaClient } from '@prisma/client'

// Singleton Prisma client (avoids exhausting connections on hot reload).
const globalForPrisma = globalThis
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
