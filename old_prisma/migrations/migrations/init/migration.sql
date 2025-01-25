-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editingAt" TIMESTAMP(3),
ADD COLUMN     "editingBy" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "creatorId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Thread_creatorId_idx" ON "Thread"("creatorId");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

