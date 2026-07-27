import { z } from "zod";

export const createVoiceRecordingSchema = z.object({
  title: z.string().min(1).max(200),
  duration: z
    .string()
    .or(z.number())
    .transform(val => Number(val))
    .pipe(z.number().int().positive()),
  fileSize: z
    .string()
    .or(z.number())
    .optional()
    .transform(val => (val !== undefined ? Number(val) : undefined))
    .pipe(z.number().int().positive().optional()),
});

export const updateVoiceRecordingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  transcription: z.string().optional(),
  isTranscribed: z.boolean().optional(),
});

export const getRecordingsQuerySchema = z.object({
  search: z.string().optional(),
  isTranscribed: z
    .string()
    .optional()
    .transform(val => val === "true"),
});
