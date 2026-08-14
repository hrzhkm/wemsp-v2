/*
  Warnings:

  - A unique constraint covering the columns `[icNumber]` on the table `non_registered_family_member` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "non_registered_family_member_icNumber_idx";

-- DropIndex
DROP INDEX "non_registered_family_member_userId_icNumber_key";

-- CreateTable
CREATE TABLE "ic_registry" (
    "icNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ic_registry_pkey" PRIMARY KEY ("icNumber")
);

-- CreateIndex
CREATE UNIQUE INDEX "non_registered_family_member_icNumber_key" ON "non_registered_family_member"("icNumber");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_icNumber_fkey" FOREIGN KEY ("icNumber") REFERENCES "ic_registry"("icNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_registered_family_member" ADD CONSTRAINT "non_registered_family_member_icNumber_fkey" FOREIGN KEY ("icNumber") REFERENCES "ic_registry"("icNumber") ON DELETE CASCADE ON UPDATE CASCADE;
