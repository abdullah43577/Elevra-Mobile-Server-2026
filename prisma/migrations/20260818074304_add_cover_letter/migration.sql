-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "coverLetterId" TEXT;

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "personalInfo" JSONB,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientTitle" TEXT,
    "companyAddress" TEXT,
    "body" TEXT NOT NULL,
    "closing" TEXT,
    "letterDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastExportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverLetter_userId_idx" ON "CoverLetter"("userId");

-- CreateIndex
CREATE INDEX "CoverLetter_templateId_idx" ON "CoverLetter"("templateId");

-- CreateIndex
CREATE INDEX "JobApplication_coverLetterId_idx" ON "JobApplication"("coverLetterId");

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
