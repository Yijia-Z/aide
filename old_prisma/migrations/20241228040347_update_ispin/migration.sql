/*
  Warnings:

  - You are about to drop the column `isPinned` on the `Thread` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Thread" DROP COLUMN "isPinned";

-- AlterTable
ALTER TABLE "ThreadMembership" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;
