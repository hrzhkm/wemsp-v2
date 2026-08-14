/*
  Warnings:

  - The values [SPOUSE] on the enum `FamilyRelation` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FamilyRelation_new" AS ENUM ('FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'SIBLING', 'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN', 'OTHER');
ALTER TABLE "family_member" ALTER COLUMN "relation" TYPE "FamilyRelation_new" USING ("relation"::text::"FamilyRelation_new");
ALTER TABLE "non_registered_family_member" ALTER COLUMN "relation" TYPE "FamilyRelation_new" USING ("relation"::text::"FamilyRelation_new");
ALTER TYPE "FamilyRelation" RENAME TO "FamilyRelation_old";
ALTER TYPE "FamilyRelation_new" RENAME TO "FamilyRelation";
DROP TYPE "public"."FamilyRelation_old";
COMMIT;
