/*
  Warnings:

  - The `role` column on the `ThreadMembership` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[email]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ThreadRole" AS ENUM ('VIEWER', 'PUBLISHER', 'EDITOR', 'OWNER');

-- CreateEnum
CREATE TYPE "ThreadMembershipStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED');

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Model" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Thread" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ThreadMembership" ADD COLUMN     "status" "ThreadMembershipStatus" NOT NULL DEFAULT 'INVITED',
DROP COLUMN "role",
ADD COLUMN     "role" "ThreadRole" NOT NULL DEFAULT 'VIEWER';

-- AlterTable
ALTER TABLE "Tool" ALTER COLUMN "createdBy" DROP NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "ThreadInvite" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "inviteEmail" TEXT NOT NULL,
    "role" "ThreadRole" NOT NULL,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ThreadInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "generationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("generationId")
);

-- CreateTable
CREATE TABLE "ThreadBlacklist" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "bannedUserId" TEXT,
    "bannedEmail" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelTool" (
    "modelId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,

    CONSTRAINT "ModelTool_pkey" PRIMARY KEY ("modelId","toolId")
);

-- CreateTable
CREATE TABLE "AvailableTool" (
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,

    CONSTRAINT "AvailableTool_pkey" PRIMARY KEY ("userId","toolId")
);

-- CreateTable
CREATE TABLE "_ModelToolsRelation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ModelToolsRelation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ThreadInvite_threadId_idx" ON "ThreadInvite"("threadId");

-- CreateIndex
CREATE INDEX "UsageRecord_userId_idx" ON "UsageRecord"("userId");

-- CreateIndex
CREATE INDEX "ThreadBlacklist_threadId_idx" ON "ThreadBlacklist"("threadId");

-- CreateIndex
CREATE INDEX "_ModelToolsRelation_B_index" ON "_ModelToolsRelation"("B");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- AddForeignKey
ALTER TABLE "ThreadInvite" ADD CONSTRAINT "ThreadInvite_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadBlacklist" ADD CONSTRAINT "ThreadBlacklist_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelTool" ADD CONSTRAINT "ModelTool_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelTool" ADD CONSTRAINT "ModelTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailableTool" ADD CONSTRAINT "AvailableTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailableTool" ADD CONSTRAINT "AvailableTool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModelToolsRelation" ADD CONSTRAINT "_ModelToolsRelation_A_fkey" FOREIGN KEY ("A") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModelToolsRelation" ADD CONSTRAINT "_ModelToolsRelation_B_fkey" FOREIGN KEY ("B") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
