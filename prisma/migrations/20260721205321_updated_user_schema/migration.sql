/*
  Warnings:

  - The values [EMAIL] on the enum `AuthProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - The `theme` column on the `UserSettings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "AuthProvider_new" AS ENUM ('PASSWORD', 'GOOGLE', 'APPLE');
ALTER TABLE "public"."User" ALTER COLUMN "authProvider" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "authProvider" TYPE "AuthProvider_new" USING ("authProvider"::text::"AuthProvider_new");
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "public"."AuthProvider_old";
ALTER TABLE "User" ALTER COLUMN "authProvider" SET DEFAULT 'PASSWORD';
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
DROP COLUMN "passwordHash",
ADD COLUMN     "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "has_onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_validated_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "profile_pic" TEXT,
ALTER COLUMN "authProvider" SET DEFAULT 'PASSWORD';

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "theme",
ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'SYSTEM';
