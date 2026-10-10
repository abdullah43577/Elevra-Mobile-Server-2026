import { BadRequestError } from "./errors";
import { resumeDataSchema, type ResumeDataInput } from "../schemas/resume-data";

const SECTIONS = ["personalInfo", "experience", "education", "skills", "languages", "certifications", "projects", "references"] as const;

// Reads the Json section columns shared by Resume and CareerProfile back into
// their validated shape. A stored null becomes an absent section.
export const parseSections = function (record: Record<string, unknown>): ResumeDataInput {
  const input = Object.fromEntries(SECTIONS.map(key => [key, record[key] ?? undefined]));

  const parsed = resumeDataSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestError("This resume has data that could not be read");
  return parsed.data;
};
