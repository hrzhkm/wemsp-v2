-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "agreement" DROP CONSTRAINT "agreement_witnessId_fkey";

-- DropForeignKey
ALTER TABLE "agreement_beneficiary" DROP CONSTRAINT "agreement_beneficiary_adminSignedById_fkey";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "admin";

-- Reconcile orphaned references before swapping FK targets from the dropped
-- "admin" table to "user". Any witnessId/adminSignedById that pointed at an
-- admin row no longer resolves to a "user" row, so null them out; otherwise
-- the FK creation below would fail on populated databases.
UPDATE "agreement" a
SET "witnessId" = NULL
WHERE a."witnessId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user" u WHERE u."id" = a."witnessId"
  );

UPDATE "agreement_beneficiary" ab
SET "adminSignedById" = NULL
WHERE ab."adminSignedById" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user" u WHERE u."id" = ab."adminSignedById"
  );

-- AddForeignKey
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_adminSignedById_fkey" FOREIGN KEY ("adminSignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
