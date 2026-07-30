-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_deadline_reminderSentAt_idx" ON "tasks"("deadline", "reminderSentAt");
