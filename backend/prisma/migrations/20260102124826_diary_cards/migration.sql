-- CreateTable
CREATE TABLE `DiaryCard` (
    `id` VARCHAR(191) NOT NULL,
    `frontMd` VARCHAR(191) NOT NULL DEFAULT '',
    `backMd` VARCHAR(191) NOT NULL DEFAULT '',
    `ownerType` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiaryCard_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `DiaryCard_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiaryTag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `ownerType` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiaryTag_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    UNIQUE INDEX `DiaryTag_ownerType_ownerId_name_key`(`ownerType`, `ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiaryCardTag` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `ownerType` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiaryCardTag_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `DiaryCardTag_tagId_idx`(`tagId`),
    UNIQUE INDEX `DiaryCardTag_cardId_tagId_key`(`cardId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiaryCardGoal` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `ownerType` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiaryCardGoal_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `DiaryCardGoal_goalId_idx`(`goalId`),
    UNIQUE INDEX `DiaryCardGoal_cardId_goalId_key`(`cardId`, `goalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiaryCardHabit` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `habitId` VARCHAR(191) NOT NULL,
    `ownerType` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiaryCardHabit_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `DiaryCardHabit_habitId_idx`(`habitId`),
    UNIQUE INDEX `DiaryCardHabit_cardId_habitId_key`(`cardId`, `habitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiaryCardTag` ADD CONSTRAINT `DiaryCardTag_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `DiaryCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryCardTag` ADD CONSTRAINT `DiaryCardTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `DiaryTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryCardGoal` ADD CONSTRAINT `DiaryCardGoal_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `DiaryCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryCardGoal` ADD CONSTRAINT `DiaryCardGoal_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryCardHabit` ADD CONSTRAINT `DiaryCardHabit_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `DiaryCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryCardHabit` ADD CONSTRAINT `DiaryCardHabit_habitId_fkey` FOREIGN KEY (`habitId`) REFERENCES `Habit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
