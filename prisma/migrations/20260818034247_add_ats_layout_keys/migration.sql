-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LayoutKey" ADD VALUE 'ATS_CLEAN';
ALTER TYPE "LayoutKey" ADD VALUE 'ATS_ACCENT';
ALTER TYPE "LayoutKey" ADD VALUE 'MODERN_BANNER';
ALTER TYPE "LayoutKey" ADD VALUE 'COMPACT_DENSE';
ALTER TYPE "LayoutKey" ADD VALUE 'TIMELINE_ACCENT';
ALTER TYPE "LayoutKey" ADD VALUE 'TECH_FOCUSED';
