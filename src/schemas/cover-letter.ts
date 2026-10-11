import { z } from "zod";
import { personalInfoSchema } from "./resume-data";

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
  applicationId: z.string().min(1).optional(),
});

// Nullable on update so a cleared field is distinguishable from an omitted one.
export const updateCoverLetterSchema = createCoverLetterSchema.omit({ applicationId: true }).partial().extend({
  recipientName: z.string().max(120).nullable().optional(),
  recipientTitle: z.string().max(120).nullable().optional(),
  companyAddress: z.string().max(300).nullable().optional(),
  closing: z.string().max(60).nullable().optional(),
});

export type CreateCoverLetterInput = z.infer<typeof createCoverLetterSchema>;

export const draftCoverLetterSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  recipientName: z.string().trim().max(120).optional(),
  applicationId: z.string().min(1).optional(),
});

export type DraftCoverLetterInput = z.infer<typeof draftCoverLetterSchema>;
