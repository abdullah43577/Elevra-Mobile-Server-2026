import { z } from "zod";
import { resumeDataSchema } from "./resume-data";

// ============================================
// Template Schemas
// ============================================

export const duplicateResumeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
});

export const getTemplatesQuerySchema = z.object({
  category: z.string().optional(),
  isPremium: z
    .enum(["true", "false"])
    .optional()
    .transform(val => (val === undefined ? undefined : val === "true")),
  search: z.string().optional(),
});

// ============================================
// Resume Schemas
// ============================================

export const createResumeSchema = resumeDataSchema.extend({
  title: z.string().min(1).max(100),
  templateId: z.string(),
});

export const updateResumeSchema = resumeDataSchema.extend({
  title: z.string().min(1).max(100).optional(),
  templateId: z.string().optional(),
  isPublished: z.boolean().optional(),
});
