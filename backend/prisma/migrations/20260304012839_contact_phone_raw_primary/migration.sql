-- AlterTable
ALTER TABLE "ContactPhone" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneRaw" TEXT NOT NULL DEFAULT '';
