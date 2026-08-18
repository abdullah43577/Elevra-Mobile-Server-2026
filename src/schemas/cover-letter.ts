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

/*
  The optional recipient fields are nullable on update, not merely optional.
  `.partial()` alone makes them `string | undefined`, and an omitted key already
  means "leave this alone" — so there was no way to say "I cleared this". A
  letter that had been addressed to someone could never be un-addressed.

  Create stays non-nullable: there is nothing to clear on a row that does not
  exist yet, and accepting null there would only widen what the service has to
  reason about.
*/
export const updateCoverLetterSchema = createCoverLetterSchema.partial().extend({
  recipientName: z.string().max(120).nullable().optional(),
  recipientTitle: z.string().max(120).nullable().optional(),
  companyAddress: z.string().max(300).nullable().optional(),
  closing: z.string().max(60).nullable().optional(),
});

export type CreateCoverLetterInput = z.infer<typeof createCoverLetterSchema>;
