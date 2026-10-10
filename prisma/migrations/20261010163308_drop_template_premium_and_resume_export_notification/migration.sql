-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('SYSTEM', 'APPLICATION_STATUS', 'APPLICATION_REMINDER', 'NOTE_SUMMARY', 'VOICE_TRANSCRIPTION');
ALTER TABLE "public"."Notification" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
ALTER TABLE "Notification" ALTER COLUMN "type" SET DEFAULT 'SYSTEM';
COMMIT;

-- DropIndex
DROP INDEX "Template_isPremium_idx";

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "isPremium";

