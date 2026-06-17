// Seed one demo user per role. Run with: npm run seed  (needs a real DATABASE_URL).
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'Password123!'

const users = [
  { fullName: 'Demo Student', email: 'student@studyflow.dev', role: 'STUDENT' },
  { fullName: 'Demo Instructor', email: 'instructor@studyflow.dev', role: 'INSTRUCTOR' },
  { fullName: 'Demo Admin', email: 'admin@studyflow.dev', role: 'ADMIN' },
]

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    })
    console.log(`Seeded ${u.role}: ${u.email}`)
  }
  console.log(`\nAll demo users use password: ${DEMO_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
