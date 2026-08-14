-- AlterTable
ALTER TABLE "agreement_beneficiary" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "adminSignedById" TEXT;

-- CreateIndex
CREATE INDEX "agreement_beneficiary_adminSignedById_idx" ON "agreement_beneficiary"("adminSignedById");

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_adminSignedById_fkey" FOREIGN KEY ("adminSignedById") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
