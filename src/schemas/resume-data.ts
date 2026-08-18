import { z } from "zod";

/*
  The section shapes shared by Resume and CareerProfile. Both models store the
  identical Json columns so the client can copy a profile straight into a new
  resume, and they must validate identically — a field the profile accepts but
  the resume rejects would silently vanish on prefill.

  These mirror `../../elevra/types/resume/data.ts`. Change one, change both.
*/

export const personalInfoSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

export const experienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
  achievements: z.array(z.string()).optional(),
});

export const educationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  gpa: z.string().optional(),
});

export const skillSchema = z.object({
  name: z.string(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

export const languageSchema = z.object({
  name: z.string(),
  proficiency: z.enum(["basic", "conversational", "professional", "native"]).optional(),
});

export const certificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string().optional(),
  expiry: z.string().optional(),
});

/*
  `url` is a plain string, not z.url(). People type "github.com/me" without a
  protocol and rejecting that loses the whole save for a cosmetic reason.
*/
export const projectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  technologies: z.array(z.string()).optional(),
});

export const referenceSchema = z.object({
  name: z.string(),
  position: z.string().optional(),
  company: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const resumeDataSchema = z.object({
  personalInfo: personalInfoSchema.optional(),
  experience: z.array(experienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  skills: z.array(skillSchema).optional(),
  languages: z.array(languageSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  projects: z.array(projectSchema).optional(),
  references: z.array(referenceSchema).optional(),
});

export type ResumeDataInput = z.infer<typeof resumeDataSchema>;
