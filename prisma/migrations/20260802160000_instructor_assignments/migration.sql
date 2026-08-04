-- AlterTable
ALTER TABLE "catalog_courses" ADD COLUMN     "instructorId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "assignmentId" TEXT;

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'ASSIGNMENT',
    "deadline" TIMESTAMP(3) NOT NULL,
    "effortHours" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignments_code_idx" ON "assignments"("code");

-- CreateIndex
CREATE INDEX "assignments_instructorId_idx" ON "assignments"("instructorId");

-- CreateIndex
CREATE INDEX "catalog_courses_instructorId_idx" ON "catalog_courses"("instructorId");

-- CreateIndex
CREATE INDEX "tasks_assignmentId_idx" ON "tasks"("assignmentId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_courses" ADD CONSTRAINT "catalog_courses_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

