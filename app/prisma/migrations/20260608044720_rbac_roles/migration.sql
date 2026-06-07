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

-- AddForeignKey
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_beneficiary" ADD CONSTRAINT "agreement_beneficiary_adminSignedById_fkey" FOREIGN KEY ("adminSignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
