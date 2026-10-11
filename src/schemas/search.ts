import { z } from "zod";

// The client's CONTENT_META keys verbatim.
export const SEARCH_RESULT_TYPES = [
  "Note",
  "Recording",
  "Resume",
  "Application",
  "CoverLetter",
  "InterviewQuestion",
] as const;

export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

export const searchQuerySchema = z.object({
  // Below two characters `contains` matches most of the library.
  q: z.string().trim().min(2, "Search needs at least 2 characters").max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
