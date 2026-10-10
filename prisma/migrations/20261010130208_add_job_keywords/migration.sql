-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "jobKeywords" JSONB,
ADD COLUMN     "jobKeywordsHash" TEXT;
