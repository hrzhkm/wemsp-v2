-- AlterTable
ALTER TABLE "agreement" ADD COLUMN     "contractAddress" TEXT,
ADD COLUMN     "metadataUri" TEXT,
ADD COLUMN     "mintTxHash" TEXT,
ADD COLUMN     "tokenId" INTEGER,
ADD COLUMN     "witnessSignatureRef" TEXT;

-- CreateIndex
CREATE INDEX "agreement_tokenId_idx" ON "agreement"("tokenId");
