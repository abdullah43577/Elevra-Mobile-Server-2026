import { z } from "zod";

// ============================================
// Template Schemas
// ============================================

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

const personalInfoSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

const experienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
  achievements: z.array(z.string()).optional(),
});

const educationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  gpa: z.string().optional(),
});

export const awardItemSchema = z.object({
  title: z.string(),
  issuer: z.string(),
  date: z.string().optional(),
  description: z.string().optional(),
});

const skillSchema = z.object({
  name: z.string(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

export const createResumeSchema = z.object({
  title: z.string().min(1).max(100),
  templateId: z.string(),
  personalInfo: personalInfoSchema.optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  skills: z.array(skillSchema).optional(),
  languages: z.array(z.object({ name: z.string(), proficiency: z.string().optional() })).optional(),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), date: z.string().optional() })).optional(),
  projects: z.array(z.object({ name: z.string(), description: z.string().optional(), url: z.string().optional() })).optional(),
  references: z.array(z.object({ name: z.string(), position: z.string().optional(), company: z.string().optional() })).optional(),
});

export const updateResumeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  templateId: z.string().optional(),
  personalInfo: personalInfoSchema.optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  skills: z.array(skillSchema).optional(),
  isPublished: z.boolean().optional(),
});
