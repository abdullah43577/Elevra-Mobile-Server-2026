import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { BadRequestError } from "../lib/errors";
import { extractStructuredJob, htmlToText, type StructuredJob } from "../lib/job-page";
import { containsTerm, normalizeText, numbersIn } from "../lib/keyword-match";
import { FetchBlockedError, fetchPublicPage } from "../lib/safe-fetch";
import type { ParseJobInput } from "../schemas/job-application";

const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 20_000;
const MIN_DESCRIPTION_CHARS = 150;

const PARSE_SYSTEM_PROMPT = `You read one job posting and return its key facts as JSON. Copy values exactly as the posting writes them, and leave out anything it does not state.
- company: the hiring company. role: the job title.
- location: city, region or country as written.
- workArrangement: "REMOTE", "HYBRID" or "ONSITE", only when the posting says so.
- salaryMin, salaryMax: annual pay as whole numbers, only when the posting states a figure or range; leave out hourly or daily rates. salaryCurrency: the 3-letter code.
- descriptionStart: the first 6 to 10 words of the job description, exactly as they appear, after any page navigation or header.
- descriptionEnd: the last 6 to 10 words of the job description, exactly as they appear, before any footer, cookie notice or application form.
Reply with JSON only: {"company", "role", "location", "workArrangement", "salaryMin", "salaryMax", "salaryCurrency", "descriptionStart", "descriptionEnd"}`;

const text = z.string().trim().nullish();
const parsedSchema = z.object({
  company: text,
  role: text,
  location: text,
  workArrangement: z.enum(["REMOTE", "HYBRID", "ONSITE"]).nullish().catch(null),
  salaryMin: z.coerce.number().nullish().catch(null),
  salaryMax: z.coerce.number().nullish().catch(null),
  salaryCurrency: text,
  descriptionStart: text,
  descriptionEnd: text,
});

export interface JobDraft {
  company?: string;
  role?: string;
  location?: string;
  workArrangement?: "REMOTE" | "HYBRID" | "ONSITE";
  jobUrl?: string;
  source?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  jobDescription?: string;
}

const SOURCES: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)indeed\./, "Indeed"],
  [/(^|\.)glassdoor\./, "Glassdoor"],
  [/(^|\.)wellfound\.com$|(^|\.)angel\.co$/, "Wellfound"],
  [/(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|bamboohr\.com|recruitee\.com|teamtailor\.com)$/, "Company website"],
];

const sourceFor = function (url: URL) {
  return SOURCES.find(([pattern]) => pattern.test(url.hostname))?.[1] ?? "Company website";
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", NGN: "₦", INR: "₹", JPY: "¥" };

const clip = (value: string, max: number) => value.slice(0, max).trim();

// Whitespace-insensitive search for a phrase the model quoted from the page.
const indexOfPhrase = function (haystack: string, phrase: string, from = 0) {
  const words = phrase.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length < 3) return null;
  const match = new RegExp(words.join("\\s+"), "i").exec(haystack.slice(from));
  return match ? { start: from + match.index, end: from + match.index + match[0].length } : null;
};

/*
  The description is cut from the page's own text between two short phrases the
  model quoted, rather than copied out by the model: verbatim by construction,
  and a few dozen output tokens instead of thousands. Without both phrases, the
  whole text is the description.
*/
const sliceDescription = function (source: string, start?: string | null, end?: string | null) {
  const from = start ? indexOfPhrase(source, start) : null;
  const to = end && from ? indexOfPhrase(source, end, from.start) : null;
  const slice = from && to && to.end > from.start ? source.slice(from.start, to.end) : source;
  return slice.trim().slice(0, MAX_TEXT_CHARS);
};

/*
  Every field the model returns must be visible in the posting: names and the
  location are matched in the text, salary figures (or their "120k" form) must
  appear, the currency needs its code or symbol, and a work arrangement needs
  its own word. Anything that fails is left blank for the user to fill.
*/
const groundDraft = function (parsed: z.infer<typeof parsedSchema>, source: string): JobDraft {
  const normalized = normalizeText(source);
  const numbers = numbersIn(source);
  const appears = (value: string | null | undefined) => (value && containsTerm(normalized, value) ? value : undefined);
  const salaryAppears = (value: number | null | undefined) =>
    value && Number.isInteger(value) && value > 0 && (numbers.has(String(value)) || (value % 1000 === 0 && new RegExp(`\\b${value / 1000}\\s?k\\b`, "i").test(source)))
      ? value
      : undefined;

  const currency = parsed.salaryCurrency?.toUpperCase();
  const currencyAppears = currency && /^[A-Z]{3}$/.test(currency) && (source.includes(currency) || (CURRENCY_SYMBOLS[currency] && source.includes(CURRENCY_SYMBOLS[currency]!)));

  const arrangementWords = { REMOTE: /\bremote\b/i, HYBRID: /\bhybrid\b/i, ONSITE: /\bon-?site\b|\bin[- ]office\b|\bin person\b/i };
  const arrangement = parsed.workArrangement && arrangementWords[parsed.workArrangement].test(source) ? parsed.workArrangement : undefined;

  const salaryMin = salaryAppears(parsed.salaryMin);
  const salaryMax = salaryAppears(parsed.salaryMax);

  return {
    ...(appears(parsed.company) && { company: clip(parsed.company!, 120) }),
    ...(appears(parsed.role) && { role: clip(parsed.role!, 120) }),
    ...(appears(parsed.location) && { location: clip(parsed.location!, 120) }),
    ...(arrangement && { workArrangement: arrangement }),
    ...(salaryMin && { salaryMin }),
    ...(salaryMax && { salaryMax }),
    ...((salaryMin || salaryMax) && currencyAppears && { salaryCurrency: currency }),
    jobDescription: sliceDescription(source, parsed.descriptionStart, parsed.descriptionEnd),
  };
};

const fromStructured = function (job: StructuredJob): JobDraft {
  return {
    ...(job.company && { company: clip(job.company, 120) }),
    ...(job.role && { role: clip(job.role, 120) }),
    ...(job.location && { location: clip(job.location, 120) }),
    ...(job.remote && { workArrangement: "REMOTE" as const }),
    ...(job.salaryMin && { salaryMin: job.salaryMin }),
    ...(job.salaryMax && { salaryMax: job.salaryMax }),
    ...(job.salaryCurrency && { salaryCurrency: job.salaryCurrency }),
    ...(job.description && { jobDescription: job.description.slice(0, MAX_TEXT_CHARS) }),
  };
};

export class JobImportService {
  /*
    Free (client CLAUDE.md §31): getting applications in is what makes the paid
    features worth having. A page carrying schema.org JobPosting data costs no
    model call and no quota; anything else uses one quota unit.

    Returns a draft for the new-application form. Nothing is saved.
  */
  async parse(userId: string, input: ParseJobInput) {
    let source: string;
    let url: URL | null = null;
    let structured: JobDraft = {};

    if (input.url) {
      try {
        const page = await fetchPublicPage(input.url);
        url = page.finalUrl;
        const job = extractStructuredJob(page.html);
        if (job) structured = fromStructured(job);

        if (structured.company && structured.role && (structured.jobDescription?.length ?? 0) >= MIN_DESCRIPTION_CHARS) {
          return { draft: { ...structured, jobUrl: input.url, source: sourceFor(url) }, method: "structured" as const };
        }
        source = htmlToText(page.html);
      } catch (error) {
        // LinkedIn serves job pages only to signed-in members; say so plainly.
        if (error instanceof FetchBlockedError && /(^|\.)linkedin\.com$/i.test(new URL(input.url).hostname)) {
          throw new FetchBlockedError("LinkedIn only shows job pages to signed-in members, so we can't read it. Copy the job description from LinkedIn and paste it here instead.");
        }
        throw error;
      }
      if (source.length < MIN_TEXT_CHARS) throw new FetchBlockedError();
    } else {
      source = input.text?.trim() ?? "";
      if (source.length < MIN_TEXT_CHARS) throw new BadRequestError("That's too short to be a job posting. Paste the whole posting, including the description.");
    }

    source = source.slice(0, MAX_TEXT_CHARS);
    await consumeAiQuota(userId);

    const { result } = await generateJson({
      system: PARSE_SYSTEM_PROMPT,
      prompt: source,
      schema: parsedSchema,
      temperature: 0,
      reasoningEffort: "low",
    });

    // Structured fields, when a page had some but not enough to skip the model, win.
    const draft: JobDraft = {
      ...groundDraft(result, source),
      ...structured,
      ...(input.url && { jobUrl: input.url }),
      ...(url && { source: sourceFor(url) }),
    };

    return { draft, method: "ai" as const };
  }
}

export { groundDraft, sliceDescription };
