/*
  Warnings:

  - You are about to drop the column `status` on the `VoiceRecording` table. All the data in the column will be lost.
  - Added the required column `title` to the `VoiceRecording` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VoiceRecording` table without a default value. This is not possible if the table is not empty.
  - Made the column `duration` on table `VoiceRecording` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "VoiceRecording" DROP CONSTRAINT "VoiceRecording_userId_fkey";

-- AlterTable
ALTER TABLE "VoiceRecording" DROP COLUMN "status",
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "isTranscribed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "transcription" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "duration" SET NOT NULL;

-- CreateIndex
CREATE INDEX "VoiceRecording_userId_idx" ON "VoiceRecording"("userId");

-- CreateIndex
CREATE INDEX "VoiceRecording_createdAt_idx" ON "VoiceRecording"("createdAt");

-- AddForeignKey
ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
