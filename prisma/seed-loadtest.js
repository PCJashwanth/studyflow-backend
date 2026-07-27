// Bulk data for Assignment 3 load testing: gives the demo student a
// realistic-scale dataset so query costs and index gains are measurable.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const N_COURSES = 40
const TASKS_PER_COURSE = 50
const day = 24 * 60 * 60 * 1000
const types = ['ASSIGNMENT', 'READING', 'EXAM', 'PRESENTATION', 'PROJECT', 'OTHER']
const priorities = ['LOW', 'MEDIUM', 'HIGH']
const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'SKIPPED']

async function main() {
  const student = await prisma.user.findUnique({ where: { email: 'student@studyflow.dev' } })
  if (!student) throw new Error('Run npm run seed first — demo student missing')

  // Clean previous load-test data (idempotent re-runs)
  await prisma.course.deleteMany({ where: { userId: student.id, code: { startsWith: 'LOAD' } } })

  for (let c = 0; c < N_COURSES; c++) {
    const course = await prisma.course.create({
      data: {
        code: `LOAD ${1000 + c}`,
        title: `Load Test Course ${c + 1}`,
        creditHours: 3,
        userId: student.id,
      },
    })
    await prisma.task.createMany({
      data: Array.from({ length: TASKS_PER_COURSE }, (_, t) => ({
        title: `Task ${t + 1} of course ${c + 1}`,
        type: types[t % types.length],
        deadline: new Date(Date.now() + ((t * 7 + c) % 120) * day),
        effortHours: (t % 8) + 1,
        priority: priorities[t % priorities.length],
        status: statuses[t % statuses.length],
        courseId: course.id,
      })),
    })
  }
  const total = await prisma.task.count({ where: { course: { userId: student.id } } })
  console.log(`Seeded ${N_COURSES} courses; student now has ${total} tasks`)
}

main().finally(() => prisma.$disconnect())
