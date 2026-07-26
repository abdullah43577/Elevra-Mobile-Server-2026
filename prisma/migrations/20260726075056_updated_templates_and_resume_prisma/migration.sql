/*
  Warnings:

  - You are about to drop the column `sections` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `styles` on the `Template` table. All the data in the column will be lost.
  - Added the required column `defaultData` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layoutKey` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Added the required column `themeId` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LayoutKey" AS ENUM ('PROFESSIONAL_CLASSIC', 'PROFESSIONAL_SLEEK', 'CREATIVE_SPLIT', 'MINIMAL_COMPACT', 'EXECUTIVE_FORMAL');

-- CreateEnum
CREATE TYPE "FontFamily" AS ENUM ('INTER', 'ROBOTO', 'MERRIWEATHER', 'LORA', 'PLAYFAIR');

-- CreateEnum
CREATE TYPE "Spacing" AS ENUM ('COMPACT', 'NORMAL', 'SPACIOUS');

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "customThemeId" TEXT;

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "sections",
DROP COLUMN "styles",
ADD COLUMN     "defaultData" JSONB NOT NULL,
ADD COLUMN     "layoutKey" "LayoutKey" NOT NULL,
ADD COLUMN     "themeId" TEXT NOT NULL,
ALTER COLUMN "thumbnail" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ResumeTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT,
    "textColor" TEXT NOT NULL,
    "fontFamily" "FontFamily" NOT NULL,
    "spacing" "Spacing" NOT NULL,
    "accentColor" TEXT,
    "sidebarColor" TEXT,
    "sidebarTextColor" TEXT,
    "showBorders" BOOLEAN,
    "showDividers" BOOLEAN,
    "useIcons" BOOLEAN,
    "goldAccent" TEXT,
    "showAwards" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resume_customThemeId_idx" ON "Resume"("customThemeId");

-- CreateIndex
CREATE INDEX "Template_layoutKey_idx" ON "Template"("layoutKey");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_customThemeId_fkey" FOREIGN KEY ("customThemeId") REFERENCES "ResumeTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ResumeTheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
