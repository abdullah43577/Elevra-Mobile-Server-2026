import { createHash } from "node:crypto";
import { z } from "zod";
import { generateJson } from "../lib/ai";
import { dedupeKeywords, type JobKeyword } from "../lib/keyword-match";
import { JobApplicationRepository } from "../repositories/job-application.repository";

export const MAX_JOB_DESCRIPTION_CHARS = 12_000;

const KEYWORD_SYSTEM_PROMPT = `You read job postings the way an applicant tracking system and a recruiter screen them.
Extract the 10-25 most important screening keywords: hard skills, tools, technologies, methodologies, certifications, domain knowledge and key qualifications.
Write each in its shortest canonical form, phrased as the posting phrases it ("React", "SQL", "stakeholder management").
Mark required true for must-haves and false for nice-to-haves.
Exclude soft-skill cliches (team player, fast-paced), the company name, benefits and locations.
Reply with JSON only: {"keywords": [{"term": string, "required": boolean}]}`;

const extractedKeywordsSchema = z.object({
  keywords: z
    .array(z.object({ term: z.string().trim().min(1).max(60), required: z.boolean() }))
    .min(1)
    .max(40),
});

const storedKeywordsSchema = z.array(z.object({ term: z.string(), required: z.boolean() }));

interface KeywordSource {
  id: string;
  jobDescription: string | null;
  jobKeywords: unknown;
  jobKeywordsHash: string | null;
}

const hashJobDescription = function (text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
};

/*
  The screening keywords of an application's posting, shared by every feature
  that writes toward a job. Extraction costs a model call, so the result is
  cached on the application against a hash of the posting it came from.
*/
export class JobKeywordService {
  private applicationRepo = new JobApplicationRepository();

  // Null when nothing was extracted yet, or the posting changed since.
  getCurrent(application: KeywordSource): JobKeyword[] | null {
    const jobDescription = application.jobDescription?.trim();
    if (!jobDescription || application.jobKeywordsHash !== hashJobDescription(jobDescription)) return null;

    const parsed = storedKeywordsSchema.safeParse(application.jobKeywords);
    return parsed.success && parsed.data.length ? parsed.data : null;
  }

  async ensure(application: KeywordSource, userId: string): Promise<JobKeyword[]> {
    const cached = this.getCurrent(application);
    if (cached) return cached;

    const jobDescription = application.jobDescription?.trim();
    if (!jobDescription) return [];

    const { result } = await generateJson({
      system: KEYWORD_SYSTEM_PROMPT,
      prompt: jobDescription.slice(0, MAX_JOB_DESCRIPTION_CHARS),
      schema: extractedKeywordsSchema,
      temperature: 0.1,
      reasoningEffort: "low",
    });

    const keywords = dedupeKeywords(result.keywords);
    await this.applicationRepo.updateJobKeywords(
      application.id,
      userId,
      keywords.map(keyword => ({ ...keyword })),
      hashJobDescription(jobDescription),
    );
    return keywords;
  }
}
