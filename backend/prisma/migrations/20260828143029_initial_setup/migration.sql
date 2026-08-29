-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `googleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `slackAccessToken` TEXT NULL,
    `slackChannelId` VARCHAR(191) NULL,
    `slackChannelName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_googleId_key`(`googleId`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailSender` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailSender_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `delayBetweenEmails` INTEGER NOT NULL,
    `hourlyLimit` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailCampaign_userId_idx`(`userId`),
    INDEX `EmailCampaign_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledEmail` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `bullJobId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `errorMessage` TEXT NULL,
    `previewUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScheduledEmail_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ScheduledEmail_campaignId_idx`(`campaignId`),
    INDEX `ScheduledEmail_userId_idx`(`userId`),
    INDEX `ScheduledEmail_senderId_idx`(`senderId`),
    INDEX `ScheduledEmail_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmailSender` ADD CONSTRAINT `EmailSender_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaign` ADD CONSTRAINT `EmailCampaign_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaign` ADD CONSTRAINT `EmailCampaign_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `EmailSender`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledEmail` ADD CONSTRAINT `ScheduledEmail_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `EmailSender`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
