-- CreateEnum
CREATE TYPE "DistributionType" AS ENUM ('FARAID', 'HIBAH', 'WASIYYAH', 'WAKAF');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURES', 'PENDING_WITNESS', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "distributionType" "DistributionType" NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "witnessId" TEXT,
    "witnessedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_asset" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "assetId" INTEGER NOT NULL,
    "allocatedValue" DOUBLE PRECISION,
    "allocatedPercentage" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_beneficiary" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "familyMemberId" INTEGER,
    "nonRegisteredFamilyMemberId" INTEGER,
    "sharePercentage" DOUBLE PRECISION NOT NULL,
    "shareDescription" TEXT,
    "hasSigned" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "signatureRef" TEXT,
    "isAccepted" BOOLEAN,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE INDEX "agreement_ownerId_idx" ON "agreement"("ownerId");

-- CreateIndex
CREATE INDEX "agreement_status_idx" ON "agreement"("status");

-- CreateIndex
CREATE INDEX "agreement_asset_agreementId_idx" ON "agreement_asset"("agreementId");

-- CreateIndex
CREATE INDEX "agreement_asset_assetId_idx" ON "agreement_asset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_asset_agreementId_assetId_key" ON "agreement_asset"("agreementId", "assetId");

-- CreateIndex
CREATE INDEX "agreement_beneficiary_agreementId_idx" ON "agreement_beneficiary"("agreementId");

-- CreateIndex
CREATE INDEX "agreement_beneficiary_familyMemberId_idx" ON "agreement_beneficiary"("familyMemberId");

-- CreateIndex
CREATE INDEX "agreement_beneficiary_nonRegisteredFamilyMemberId_idx" ON "agreement_beneficiary"("nonRegisteredFamilyMemberId");

-- AddForeignKey
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_asset" ADD CONSTRAINT "agreement_asset_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_asset" ADD CONSTRAINT "agreement_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_nonRegisteredFamilyMemberId_fkey" FOREIGN KEY ("nonRegisteredFamilyMemberId") REFERENCES "non_registered_family_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
