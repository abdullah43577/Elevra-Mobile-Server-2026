import { z } from "zod";

const applicationStatus = z.enum(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"]);
const workArrangement = z.enum(["ONSITE", "HYBRID", "REMOTE"]);

export const createJobApplicationSchema = z.object({
  company: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  location: z.string().max(120).optional(),
  workArrangement: workArrangement.optional(),
  jobUrl: z.url().max(2000).optional(),
  source: z.string().max(60).optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  salaryCurrency: z.string().length(3).optional(),
  status: applicationStatus.optional(),
  appliedAt: z.iso.datetime().optional(),
  notes: z.string().max(5000).optional(),
  jobDescription: z.string().max(20000).optional(),
  resumeId: z.string().optional(),
  coverLetterId: z.string().optional(),
});

export const updateJobApplicationSchema = z.object({
  company: z.string().min(1).max(120).optional(),
  role: z.string().min(1).max(120).optional(),
  location: z.string().max(120).nullable().optional(),
  workArrangement: workArrangement.nullable().optional(),
  jobUrl: z.url().max(2000).nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  salaryCurrency: z.string().length(3).nullable().optional(),
  status: applicationStatus.optional(),
  appliedAt: z.iso.datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  jobDescription: z.string().max(20000).nullable().optional(),
  resumeId: z.string().nullable().optional(),
  coverLetterId: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;

export const getJobApplicationsQuerySchema = z.object({
  status: applicationStatus.optional(),
  search: z.string().optional(),
  isArchived: z
    .enum(["true", "false"])
    .transform(value => value === "true")
    .optional(),
});

export const linkNoteSchema = z.object({
  noteId: z.string().min(1),
});

export const linkRecordingSchema = z.object({
  recordingId: z.string().min(1),
});

export const messageKindSchema = z.enum(["FOLLOW_UP", "THANK_YOU", "ACCEPT_OFFER", "NEGOTIATE_OFFER", "DECLINE_OFFER", "REJECTION_REPLY"]);

export type MessageKind = z.infer<typeof messageKindSchema>;

export const draftMessageSchema = z.object({
  kind: messageKindSchema,
  interviewerName: z.string().trim().min(1).max(80).optional(),
  points: z.string().trim().min(1).max(1000).optional(),
});

export type DraftMessageInput = z.infer<typeof draftMessageSchema>;

export const parseJobSchema = z
  .object({
    url: z.string().trim().min(1).max(2000).optional(),
    text: z.string().trim().min(1).max(50_000).optional(),
  })
  .refine(value => !!value.url !== !!value.text, { message: "Send either a link or the posting text" });

export type ParseJobInput = z.infer<typeof parseJobSchema>;

// No baseResumeId means tailor from the career profile.
export const tailorResumeSchema = z.object({
  baseResumeId: z.string().min(1).optional(),
});
