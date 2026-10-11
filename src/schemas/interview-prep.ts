import { z } from "zod";

const categorySchema = z.enum([
  "BACKGROUND",
  "BEHAVIOURAL",
  "SITUATIONAL",
  "MOTIVATION",
  "STRENGTHS",
  "ROLE_SPECIFIC",
  "CLOSING",
]);

export const generateQuestionsSchema = z.object({
  applicationId: z.string().min(1),
});

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

// Nullable, not just optional: clearing needs null because JSON drops undefined keys.
export const saveAnswerSchema = z.object({
  text: z.string().nullable().optional(),
  status: statusSchema.optional(),
});

export const recordPracticeSchema = z.object({
  questionIds: z.array(z.string()).min(1).max(100),
});

export const uploadAnswerAudioSchema = z.object({
  duration: z.coerce.number().int().nonnegative(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
