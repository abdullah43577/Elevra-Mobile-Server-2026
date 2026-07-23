import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  folderId: z.string().optional(),
  tagNames: z.array(z.string().min(1).max(30)).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  folderId: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const getNotesQuerySchema = z.object({
  folderId: z.string().optional(),
  search: z.string().optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(30),
});
