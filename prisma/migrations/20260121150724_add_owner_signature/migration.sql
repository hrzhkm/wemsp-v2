-- AlterTable
ALTER TABLE "agreement" ADD COLUMN     "ownerHasSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerSignatureRef" TEXT,
ADD COLUMN     "ownerSignedAt" TIMESTAMP(3);
