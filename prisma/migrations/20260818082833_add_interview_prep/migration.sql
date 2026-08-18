-- CreateEnum
CREATE TYPE "InterviewCategory" AS ENUM ('BACKGROUND', 'BEHAVIOURAL', 'SITUATIONAL', 'MOTIVATION', 'STRENGTHS', 'CLOSING');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('DRAFT', 'NEEDS_WORK', 'READY');

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" "InterviewCategory" NOT NULL,
    "guidance" TEXT,
    "userId" TEXT,
    "seedKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT,
    "audioUrl" TEXT,
    "audioDuration" INTEGER,
    "status" "AnswerStatus" NOT NULL DEFAULT 'DRAFT',
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_seedKey_key" ON "InterviewQuestion"("seedKey");

-- CreateIndex
CREATE INDEX "InterviewQuestion_userId_idx" ON "InterviewQuestion"("userId");

-- CreateIndex
CREATE INDEX "InterviewQuestion_category_idx" ON "InterviewQuestion"("category");

-- CreateIndex
CREATE INDEX "InterviewAnswer_userId_idx" ON "InterviewAnswer"("userId");

-- CreateIndex
CREATE INDEX "InterviewAnswer_status_idx" ON "InterviewAnswer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewAnswer_userId_questionId_key" ON "InterviewAnswer"("userId", "questionId");

-- CreateIndex
CREATE INDEX "ApplicationQuestion_questionId_idx" ON "ApplicationQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationQuestion_applicationId_questionId_key" ON "ApplicationQuestion"("applicationId", "questionId");

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
