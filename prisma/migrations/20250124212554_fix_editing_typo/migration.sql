/*
  Warnings:

  - You are about to drop the column `editingdBy` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "editingdBy",
ADD COLUMN     "editingBy" TEXT;
