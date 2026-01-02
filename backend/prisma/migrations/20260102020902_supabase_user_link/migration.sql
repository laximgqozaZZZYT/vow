/*
  Warnings:

  - A unique constraint covering the columns `[supabaseUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `supabaseUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_supabaseUserId_key` ON `User`(`supabaseUserId`);
