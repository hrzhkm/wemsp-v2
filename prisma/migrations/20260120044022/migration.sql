/*
  Warnings:

  - A unique constraint covering the columns `[icNumber]` on the table `ic_registry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `asset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PROPERTY', 'VEHICLE', 'INVESTMENT', 'OTHER');

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "type" "AssetType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ic_registry_icNumber_key" ON "ic_registry"("icNumber");
