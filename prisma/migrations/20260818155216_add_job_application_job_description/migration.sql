-- The posting itself, pasted onto the application. Additive and nullable, so
-- existing rows are untouched.
ALTER TABLE "JobApplication" ADD COLUMN "jobDescription" TEXT;
