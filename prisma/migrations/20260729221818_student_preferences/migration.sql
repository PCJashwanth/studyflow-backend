-- CreateTable
CREATE TABLE "student_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availabilityGrid" JSONB,
    "maxStudyHours" INTEGER NOT NULL DEFAULT 6,
    "focusTime" TEXT NOT NULL DEFAULT 'Evening',
    "minBreakMins" INTEGER NOT NULL DEFAULT 15,
    "notifyBeforeBlocks" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_preferences_userId_key" ON "student_preferences"("userId");

-- AddForeignKey
ALTER TABLE "student_preferences" ADD CONSTRAINT "student_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
