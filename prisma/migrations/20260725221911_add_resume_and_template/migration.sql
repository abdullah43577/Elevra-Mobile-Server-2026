/*
  Warnings:

  - You are about to drop the column `atsScore` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Resume` table. All the data in the column will be lost.
  - You are about to drop the column `previewUrl` on the `Template` table. All the data in the column will be lost.
  - Made the column `templateId` on table `Resume` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `thumbnail` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Resume" DROP CONSTRAINT "Resume_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Resume" DROP CONSTRAINT "Resume_userId_fkey";

-- AlterTable
ALTER TABLE "Resume" DROP COLUMN "atsScore",
DROP COLUMN "content",
ADD COLUMN     "certifications" JSONB,
ADD COLUMN     "education" JSONB,
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" JSONB,
ADD COLUMN     "lastExportedAt" TIMESTAMP(3),
ADD COLUMN     "personalInfo" JSONB,
ADD COLUMN     "projects" JSONB,
ADD COLUMN     "references" JSONB,
ADD COLUMN     "skills" JSONB,
ALTER COLUMN "templateId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "previewUrl",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sections" JSONB,
ADD COLUMN     "styles" JSONB,
ADD COLUMN     "thumbnail" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Resume_userId_idx" ON "Resume"("userId");

-- CreateIndex
CREATE INDEX "Resume_templateId_idx" ON "Resume"("templateId");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_isPremium_idx" ON "Template"("isPremium");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
