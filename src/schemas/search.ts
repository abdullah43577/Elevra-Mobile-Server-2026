import { z } from "zod";

/*
  These keys are the client's CONTENT_META keys verbatim, not a server-side
  naming. Global search results carry their own icon, colour and label on the
  client, and matching the existing map means the search screen reads
  CONTENT_META[result.type] directly instead of maintaining a translation table
  that would drift the first time a content type is added.
*/
export const SEARCH_RESULT_TYPES = [
  "Note",
  "Recording",
  "Resume",
  "Application",
  "CoverLetter",
  "InterviewQuestion",
] as const;

export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

/*
  There is no `types` filter. Every search returns all six, capped per type, and
  the client's filter chips narrow what it already holds — the chips have to show
  a count for every type to be usable at all, and asking the server for one type
  would zero out the other five the moment a chip was tapped.
*/
export const searchQuerySchema = z.object({
  // Two characters is the floor at which `contains` stops matching most of the
  // library. A single letter would return every row the user owns.
  q: z.string().trim().min(2, "Search needs at least 2 characters").max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
