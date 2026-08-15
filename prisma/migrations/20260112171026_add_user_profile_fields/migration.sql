/*
  Warnings:

  - A unique constraint covering the columns `[icNumber]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FamilyRelation" AS ENUM ('FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER', 'SPOUSE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN', 'OTHER');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "address" TEXT,
ADD COLUMN     "icNumber" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "family_member" (
    "id" SERIAL NOT NULL,
    "relation" "FamilyRelation" NOT NULL,
    "userId" TEXT NOT NULL,
    "familyMemberUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_registered_family_member" (
    "id" SERIAL NOT NULL,
    "relation" "FamilyRelation" NOT NULL,
    "name" TEXT NOT NULL,
    "icNumber" TEXT NOT NULL,
    "address" TEXT,
    "phoneNumber" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_registered_family_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_member_userId_idx" ON "family_member"("userId");

-- CreateIndex
CREATE INDEX "family_member_familyMemberUserId_idx" ON "family_member"("familyMemberUserId");

-- CreateIndex
CREATE UNIQUE INDEX "family_member_userId_familyMemberUserId_key" ON "family_member"("userId", "familyMemberUserId");

-- CreateIndex
CREATE INDEX "non_registered_family_member_userId_idx" ON "non_registered_family_member"("userId");

-- CreateIndex
CREATE INDEX "non_registered_family_member_icNumber_idx" ON "non_registered_family_member"("icNumber");

-- CreateIndex
CREATE UNIQUE INDEX "non_registered_family_member_userId_icNumber_key" ON "non_registered_family_member"("userId", "icNumber");

-- CreateIndex
CREATE UNIQUE INDEX "user_icNumber_key" ON "user"("icNumber");

-- AddForeignKey
ALTER TABLE "family_member" ADD CONSTRAINT "family_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_member" ADD CONSTRAINT "family_member_familyMemberUserId_fkey" FOREIGN KEY ("familyMemberUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_registered_family_member" ADD CONSTRAINT "non_registered_family_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
