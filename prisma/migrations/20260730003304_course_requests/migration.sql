-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "course_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructorName" TEXT,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "course_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_requests_studentId_idx" ON "course_requests"("studentId");

-- CreateIndex
CREATE INDEX "course_requests_status_idx" ON "course_requests"("status");

-- AddForeignKey
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
