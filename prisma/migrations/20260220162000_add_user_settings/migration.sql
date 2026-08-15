-- CreateTable
CREATE TABLE "user_setting" (
    "userId" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "emailSignatureRequests" BOOLEAN NOT NULL DEFAULT true,
    "inAppSignatureRequests" BOOLEAN NOT NULL DEFAULT true,
    "emailAgreementStatusUpdates" BOOLEAN NOT NULL DEFAULT true,
    "inAppAgreementStatusUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailWitnessConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "inAppWitnessConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "emailExpiryReminders" BOOLEAN NOT NULL DEFAULT true,
    "inAppExpiryReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_setting_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
