/*
  Warnings:

  - You are about to drop the column `editingAt` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `editingBy` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "editingAt",
DROP COLUMN "editingBy";
