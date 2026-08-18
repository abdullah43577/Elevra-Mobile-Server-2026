import { z } from "zod";
import { personalInfoSchema } from "./resume-data";

/*
  The body is one string with blank lines between paragraphs, not a set of
  structured fields. That is how people actually write letters, it exports to
  clean <p> tags, and it never fights someone who wants two paragraphs or five.
*/
export const createCoverLetterSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  templateId: z.string(),
  personalInfo: personalInfoSchema.optional(),
  company: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  recipientName: z.string().max(120).optional(),
  recipientTitle: z.string().max(120).optional(),
  companyAddress: z.string().max(300).optional(),
  body: z.string().min(1),
  closing: z.string().max(60).optional(),
});

export const updateCoverLetterSchema = createCoverLetterSchema.partial();

export type CreateCoverLetterInput = z.infer<typeof createCoverLetterSchema>;
