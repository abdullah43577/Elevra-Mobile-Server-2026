import { SearchRepository } from "../repositories/search.repository";
import { SEARCH_RESULT_TYPES, type SearchResultType } from "../schemas/search";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  snippet?: string;
  updatedAt: Date;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  counts: Record<SearchResultType, number>;
  total: number;
}

const DEFAULT_LIMIT_PER_TYPE = 20;
const SNIPPET_LEAD = 32;
const SNIPPET_TRAIL = 96;

// Display-only: note content is tentap HTML, and a raw slice would render tags in a result row.
const stripMarkup = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

const buildSnippet = (body: string | null | undefined, term: string): string | undefined => {
  if (!body) return undefined;

  const text = stripMarkup(body);
  if (!text) return undefined;

  const index = text.toLowerCase().indexOf(term.toLowerCase());

  if (index === -1) {
    return text.length > SNIPPET_TRAIL ? `${text.slice(0, SNIPPET_TRAIL).trim()}...` : text;
  }

  const start = Math.max(0, index - SNIPPET_LEAD);
  const end = Math.min(text.length, index + term.length + SNIPPET_TRAIL);

  return `${start > 0 ? "..." : ""}${text.slice(start, end).trim()}${end < text.length ? "..." : ""}`;
};

const includesTerm = (value: string | null | undefined, term: string) =>
  !!value && value.toLowerCase().includes(term.toLowerCase());

const humanise = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export class SearchService {
  private searchRepo = new SearchRepository();

  async search(
    userId: string,
    options: { query: string; limit?: number },
  ): Promise<SearchResponse> {
    const term = options.query.trim();
    const limit = options.limit ?? DEFAULT_LIMIT_PER_TYPE;

    const [notes, recordings, resumes, applications, coverLetters, questions] = await Promise.all([
      this.searchRepo.searchNotes(userId, term, limit),
      this.searchRepo.searchRecordings(userId, term, limit),
      this.searchRepo.searchResumes(userId, term, limit),
      this.searchRepo.searchApplications(userId, term, limit),
      this.searchRepo.searchCoverLetters(userId, term, limit),
      this.searchRepo.searchInterviewQuestions(userId, term, limit),
    ]);

    const ranked: { result: SearchResult; isTitleMatch: boolean }[] = [];

    for (const note of notes) {
      const snippet = buildSnippet(note.content, term);

      ranked.push({
        result: {
          id: note.id,
          type: "Note",
          title: note.title,
          ...(note.isArchived
            ? { subtitle: "Archived" }
            : note.folder && { subtitle: note.folder.name }),
          ...(snippet && { snippet }),
          updatedAt: note.updatedAt,
        },
        isTitleMatch: includesTerm(note.title, term),
      });
    }

    for (const recording of recordings) {
      const snippet = buildSnippet(recording.transcription, term);

      ranked.push({
        result: {
          id: recording.id,
          type: "Recording",
          title: recording.title,
          ...(snippet && { snippet }),
          updatedAt: recording.updatedAt,
        },
        isTitleMatch: includesTerm(recording.title, term),
      });
    }

    for (const resume of resumes) {
      ranked.push({
        result: {
          id: resume.id,
          type: "Resume",
          title: resume.title,
          ...(resume.template && { subtitle: resume.template.name }),
          updatedAt: resume.updatedAt,
        },
        isTitleMatch: true,
      });
    }

    for (const application of applications) {
      const snippet = includesTerm(application.notes, term)
        ? buildSnippet(application.notes, term)
        : undefined;

      ranked.push({
        result: {
          id: application.id,
          type: "Application",
          title: application.company,
          subtitle: application.isArchived ? `${application.role} · Archived` : application.role,
          ...(snippet && { snippet }),
          updatedAt: application.updatedAt,
        },
        isTitleMatch:
          includesTerm(application.company, term) || includesTerm(application.role, term),
      });
    }

    for (const letter of coverLetters) {
      const snippet = buildSnippet(letter.body, term);

      ranked.push({
        result: {
          id: letter.id,
          type: "CoverLetter",
          title: letter.title,
          subtitle: `${letter.company} · ${letter.role}`,
          ...(snippet && { snippet }),
          updatedAt: letter.updatedAt,
        },
        isTitleMatch:
          includesTerm(letter.title, term) ||
          includesTerm(letter.company, term) ||
          includesTerm(letter.role, term),
      });
    }

    for (const question of questions) {
      const answer = question.answers[0];
      const snippet = buildSnippet(answer?.text, term);

      ranked.push({
        result: {
          id: question.id,
          type: "InterviewQuestion",
          title: question.text,
          subtitle: humanise(question.category),
          ...(snippet && { snippet }),
          // Dated by the answer: the seeded questions never change, so their updatedAt would all tie.
          updatedAt: answer?.updatedAt ?? question.updatedAt,
        },
        isTitleMatch: includesTerm(question.text, term),
      });
    }

    ranked.sort((a, b) => {
      if (a.isTitleMatch !== b.isTitleMatch) return a.isTitleMatch ? -1 : 1;
      return b.result.updatedAt.getTime() - a.result.updatedAt.getTime();
    });

    const results = ranked.map(entry => entry.result);

    // Counts come from the capped rows rather than COUNT queries, so a chip shows at most `limit`.
    const counts = SEARCH_RESULT_TYPES.reduce(
      (accumulator, type) => {
        accumulator[type] = results.filter(result => result.type === type).length;
        return accumulator;
      },
      {} as Record<SearchResultType, number>,
    );

    return { query: term, results, counts, total: results.length };
  }
}
