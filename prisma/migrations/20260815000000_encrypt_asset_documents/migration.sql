DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "asset" WHERE "documentUrl" IS NOT NULL) THEN
        RAISE EXCEPTION 'Legacy asset documents must be migrated before enabling encrypted R2 storage';
    END IF;
END $$;

-- CreateTable
CREATE TABLE "user_document_encryption_key" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerWrappedFek" BYTEA NOT NULL,
    "answerSalt" BYTEA NOT NULL,
    "answerIv" BYTEA NOT NULL,
    "answerAuthTag" BYTEA NOT NULL,
    "recoveryWrappedFek" BYTEA NOT NULL,
    "recoveryIv" BYTEA NOT NULL,
    "recoveryAuthTag" BYTEA NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "recoveryKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_document_encryption_key_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "asset" ADD COLUMN "documentEncrypted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_document_encryption_key" ADD CONSTRAINT "user_document_encryption_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
