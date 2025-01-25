/*
  Warnings:

  - You are about to drop the column `lockedAt` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `lockedBy` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "lockedAt",
DROP COLUMN "lockedBy",
ADD COLUMN     "editingAt" TIMESTAMP(3),
ADD COLUMN     "editingdBy" TEXT;
