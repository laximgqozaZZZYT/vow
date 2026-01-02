/*
  Warnings:

  - You are about to drop the column `userId` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Habit` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Preference` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[key,ownerType,ownerId]` on the table `Preference` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Activity` DROP FOREIGN KEY `Activity_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Goal` DROP FOREIGN KEY `Goal_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Habit` DROP FOREIGN KEY `Habit_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Preference` DROP FOREIGN KEY `Preference_userId_fkey`;

-- DropIndex
DROP INDEX `Preference_key_userId_key` ON `Preference`;

-- AlterTable
ALTER TABLE `Activity` DROP COLUMN `userId`,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `ownerType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Goal` DROP COLUMN `userId`,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `ownerType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Habit` DROP COLUMN `userId`,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `ownerType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Preference` DROP COLUMN `userId`,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    ADD COLUMN `ownerType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `Guest` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mergedIntoUserId` VARCHAR(191) NULL,
    `mergedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_guestId_idx`(`guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_ownerType_ownerId_idx` ON `Activity`(`ownerType`, `ownerId`);

-- CreateIndex
CREATE INDEX `Goal_ownerType_ownerId_idx` ON `Goal`(`ownerType`, `ownerId`);

-- CreateIndex
CREATE INDEX `Habit_ownerType_ownerId_idx` ON `Habit`(`ownerType`, `ownerId`);

-- CreateIndex
CREATE INDEX `Preference_ownerType_ownerId_idx` ON `Preference`(`ownerType`, `ownerId`);

-- CreateIndex
CREATE UNIQUE INDEX `Preference_key_ownerType_ownerId_key` ON `Preference`(`key`, `ownerType`, `ownerId`);
