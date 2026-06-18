// Seeds demo data for all three roles. Run with: npm run seed
// Idempotent: re-running resets the demo students' courses/tasks.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const DEMO_PASSWORD = 'Password123!'
const day = 24 * 60 * 60 * 1000

async function upsertUser(email, fullName, role, passwordHash) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role },
    create: { email, fullName, role, passwordHash },
  })
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const now = Date.now()

  // Core demo accounts
  await upsertUser('admin@studyflow.dev', 'Demo Admin', 'ADMIN', passwordHash)
  const instructor = await upsertUser('instructor@studyflow.dev', 'Demo Instructor', 'INSTRUCTOR', passwordHash)
  const student = await upsertUser('student@studyflow.dev', 'Demo Student', 'STUDENT', passwordHash)

  // Extra students so the instructor dashboard has anonymized aggregate data.
  const student2 = await upsertUser('student2@studyflow.dev', 'Demo Student Two', 'STUDENT', passwordHash)
  const student3 = await upsertUser('student3@studyflow.dev', 'Demo Student Three', 'STUDENT', passwordHash)
  const students = [student, student2, student3]

  // Reset demo students' course data for a clean re-seed.
  await prisma.course.deleteMany({ where: { userId: { in: students.map((s) => s.id) } } })

  // Each student "enrolls" in the same two courses, both taught by the demo instructor.
  const catalog = [
    { code: 'CSCI 5709', title: 'Adv. Topics in Web Development', creditHours: 3 },
    { code: 'CSCI 6612', title: 'Visual Analytics', creditHours: 3 },
  ]

  const taskTemplates = [
    { title: 'Assignment 1', type: 'ASSIGNMENT', effortHours: 6, priority: 'HIGH', offset: 4 },
    { title: 'Reading: Chapter 3', type: 'READING', effortHours: 2, priority: 'LOW', offset: 2 },
    { title: 'Midterm Exam', type: 'EXAM', effortHours: 8, priority: 'HIGH', offset: 10 },
    { title: 'Group Project Milestone', type: 'PROJECT', effortHours: 5, priority: 'MEDIUM', offset: 14 },
  ]
  const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'SKIPPED']

  let s = 0
  for (const stu of students) {
    let c = 0
    for (const course of catalog) {
      const created = await prisma.course.create({
        data: {
          ...course,
          instructorName: 'Demo Instructor',
          userId: stu.id,
          instructorId: instructor.id,
        },
      })
      for (let i = 0; i < taskTemplates.length; i++) {
        const t = taskTemplates[i]
        await prisma.task.create({
          data: {
            courseId: created.id,
            title: t.title,
            type: t.type,
            effortHours: t.effortHours,
            priority: t.priority,
            // vary status per student so completion rates differ
            status: statuses[(s + i) % statuses.length],
            deadline: new Date(now + (t.offset + c * 3) * day),
          },
        })
      }
      c++
    }
    s++
  }

  console.log('Seeded users (password: ' + DEMO_PASSWORD + '):')
  console.log('  admin@studyflow.dev (ADMIN)')
  console.log('  instructor@studyflow.dev (INSTRUCTOR)')
  console.log('  student@studyflow.dev, student2@, student3@ (STUDENT)')
  console.log(`Seeded ${students.length} students x ${catalog.length} courses x ${taskTemplates.length} tasks.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
