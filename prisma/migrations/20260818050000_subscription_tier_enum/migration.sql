-- Converts UserSettings.subscriptionTier from a loose String to an enum.
-- The USING clause maps existing values explicitly; without it Postgres
-- refuses the type change and Prisma would offer to drop the column.

CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');

ALTER TABLE "UserSettings" ALTER COLUMN "subscriptionTier" DROP DEFAULT;

ALTER TABLE "UserSettings"
  ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier"
  USING (
    CASE WHEN upper("subscriptionTier") = 'PRO' THEN 'PRO' ELSE 'FREE' END
  )::"SubscriptionTier";

ALTER TABLE "UserSettings" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';
