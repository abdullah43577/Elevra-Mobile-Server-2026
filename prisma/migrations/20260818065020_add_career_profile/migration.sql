-- CreateTable
CREATE TABLE "CareerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalInfo" JSONB,
    "experience" JSONB,
    "education" JSONB,
    "skills" JSONB,
    "languages" JSONB,
    "certifications" JSONB,
    "projects" JSONB,
    "references" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfile_userId_key" ON "CareerProfile"("userId");

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
