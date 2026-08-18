import { z } from "zod";

const categorySchema = z.enum([
  "BACKGROUND",
  "BEHAVIOURAL",
  "SITUATIONAL",
  "MOTIVATION",
  "STRENGTHS",
  "CLOSING",
]);

const statusSchema = z.enum(["DRAFT", "NEEDS_WORK", "READY"]);

export const getQuestionsQuerySchema = z.object({
  category: categorySchema.optional(),
  status: statusSchema.optional(),
  search: z.string().optional(),
  applicationId: z.string().optional(),
  unanswered: z
    .enum(["true", "false"])
    .optional()
    .transform(value => (value === undefined ? undefined : value === "true")),
});

export const createQuestionSchema = z.object({
  text: z.string().min(1).max(400),
  category: categorySchema,
  guidance: z.string().max(400).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

/*
  `text` is nullable, not just optional: clearing a written answer has to be
  distinguishable from not touching it, and JSON.stringify drops undefined keys.
*/
export const saveAnswerSchema = z.object({
  text: z.string().nullable().optional(),
  status: statusSchema.optional(),
});

/*
  A whole practice run reports once, at the end. Per-question requests would mean
  a session that half records itself on a bad connection — and rehearsing is
  exactly the moment someone is somewhere with poor signal.
*/
export const recordPracticeSchema = z.object({
  questionIds: z.array(z.string()).min(1).max(100),
});

export const uploadAnswerAudioSchema = z.object({
  duration: z.coerce.number().int().nonnegative(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
