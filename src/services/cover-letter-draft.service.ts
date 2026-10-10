import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { AiUnavailableError, BadRequestError, NotFoundError } from "../lib/errors";
import { buildClaimGuard, containsTerm, contentWords, normalizeText, resumeText, type EvidencedTerm } from "../lib/keyword-match";
import { filterSentences, LETTER_VOCABULARY } from "../lib/sentence-guard";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import type { DraftCoverLetterInput } from "../schemas/cover-letter";
import type { ResumeDataInput } from "../schemas/resume-data";
import { CandidateSourceService } from "./candidate-source.service";
import { JobKeywordService, MAX_JOB_DESCRIPTION_CHARS } from "./job-keyword.service";

const DRAFT_SYSTEM_PROMPT = `You are the candidate, writing your own cover letter in the first person from the facts in your resume. Breaking any rule below makes the letter unusable.
1. Every claim about yourself comes from the resume: employers, titles, skills, tools, results and numbers. Never invent, estimate or round up. Do not mention any requirement the resume does not show; lead with what it does show.
2. Never add consequences, impact, responsibilities or qualities the resume does not state: no "reduced incidents", "ensured data integrity" or "met strict SLAs" unless the resume says so.
3. When you describe yourself with one of missingKeywords, add it to newTerms with evidence: an exact quote of a few words copied from the resume. No quote, no keyword.
4. Say why this role appeals using only the posting. If there is no posting, say nothing about the company beyond its name and the role.
5. 3 or 4 paragraphs of about targetWords words in total; shorter is fine, padding is not. An opening that names the role, two or three concrete matches between your experience and the role, and a short close asking to talk. Name the company at most twice and never state the same fact twice.
6. Write naturally, plain, confident and specific. Never refer to "the resume", "the candidate" or "the posting". No cliches ("I am writing to express my interest", "team player", "passionate", "fast-paced") and no flattery.
7. No greeting, no sign-off, no name and no contact details. Those are added separately.
8. If the input has a revise block, write the letter again without any of its rejected claims.
Reply with JSON only: {"paragraphs": string[], "newTerms": [{"term": string, "evidence": string}]}`;

const draftOutputSchema = z.object({
  paragraphs: z.array(z.string()).min(2).max(8),
  newTerms: z.array(z.object({ term: z.string(), evidence: z.string() })).optional(),
});

// Scaled to how much there is to say, so a thin resume gets a short honest
// letter instead of a long padded one — padding is where invention creeps in.
const targetWordsFor = function (data: ResumeDataInput) {
  const facts =
    (data.experience ?? []).reduce((count, entry) => count + (entry.achievements?.length ?? 0) + (entry.description ? 1 : 0), 0) +
    (data.projects ?? []).filter(project => project.description).length;
  return Math.min(300, Math.max(140, 90 + facts * 30));
};

export class CoverLetterDraftService {
  private applicationRepo = new JobApplicationRepository();
  private candidateSource = new CandidateSourceService();
  private keywordService = new JobKeywordService();

  /*
    Not streamed, deliberately. Every sentence is checked against the
    candidate's material before the user sees any of it, and a stream would
    show the claims first and retract them after.

    A letter has no original to fall back to the way a tailored resume does,
    so a sentence making an unsupported claim is removed rather than reverted.
    When that happens the model gets one revision with the rejected claims named,
    and whichever version keeps more supported text wins — removal alone left
    letters choppy and thin in testing.
  */
  async draft(userId: string, input: DraftCoverLetterInput) {
    await assertPro(userId, PRO_FEATURES.AI_COVER_LETTER);

    const application = input.applicationId ? await this.applicationRepo.findById(input.applicationId, userId) : null;
    if (input.applicationId && !application) throw new NotFoundError("Application not found");

    const source = await this.candidateSource.find(userId, application?.resumeId ?? null);
    if (!source) {
      throw new BadRequestError("Add your work experience to your career profile or a resume first. The draft is written from it.");
    }

    // One quota unit per draft, though it can take up to three model calls.
    await consumeAiQuota(userId);

    const keywords = application ? await this.keywordService.ensure(application, userId) : [];
    const candidateText = resumeText(source.data);
    const normalizedCandidate = normalizeText(candidateText);
    const posting = application?.jobDescription?.trim().slice(0, MAX_JOB_DESCRIPTION_CHARS);

    const request = {
      role: input.role,
      company: input.company,
      ...(input.recipientName && { recipientName: input.recipientName }),
      ...(posting && { posting }),
      targetWords: targetWordsFor(source.data),
      keywords: keywords.map(keyword => keyword.term),
      missingKeywords: keywords.filter(keyword => !containsTerm(normalizedCandidate, keyword.term)).map(keyword => keyword.term),
      resume: {
        headline: source.data.personalInfo?.title,
        summary: source.data.personalInfo?.summary,
        experience: (source.data.experience ?? []).map(entry => ({
          position: entry.position,
          company: entry.company,
          current: entry.current ?? false,
          description: entry.description,
          achievements: entry.achievements,
        })),
        skills: (source.data.skills ?? []).map(skill => skill.name),
        projects: (source.data.projects ?? []).map(entry => ({ name: entry.name, description: entry.description })),
        education: (source.data.education ?? []).map(entry => [entry.degree, entry.field, entry.school].filter(Boolean).join(", ")),
        certifications: (source.data.certifications ?? []).map(cert => cert.name),
      },
    };

    const write = async function (prompt: object) {
      const { result } = await generateJson({
        system: DRAFT_SYSTEM_PROMPT,
        prompt: JSON.stringify(prompt),
        schema: draftOutputSchema,
        temperature: 0.3,
        reasoningEffort: "medium",
        maxTokens: 6144,
      });
      return result;
    };

    let best = this.applyGuard(await write(request), candidateText, input, keywords, posting);

    if (best.removed.length) {
      const revised = this.applyGuard(
        await write({ ...request, revise: { draft: best.body, rejectedClaims: best.removed } }),
        candidateText,
        input,
        keywords,
        posting,
      );
      if (revised.keptWords > best.keptWords) best = revised;
    }

    if (best.paragraphCount < 2) {
      throw new AiUnavailableError("The draft kept claiming things your resume doesn't say, so it was discarded. Please try again.");
    }

    return { body: best.body, removedSentences: best.removed.length, addedTerms: best.addedTerms, source: source.label };
  }

  /*
    A sentence survives only if it passes the shared claim guard (no unsupported
    job keyword, no number the candidate's material lacks) and is grounded: at
    least half of its substantive words appear in the resume, the posting, or the
    names of the role and company. The second check exists because the first
    could not see invented outcomes — in testing a draft claimed "strict SLA
    limits" and "reduced production incidents", neither of which is a keyword.
  */
  private applyGuard(
    output: z.infer<typeof draftOutputSchema>,
    candidateText: string,
    input: DraftCoverLetterInput,
    keywords: Awaited<ReturnType<JobKeywordService["ensure"]>>,
    posting?: string,
  ) {
    const guard = buildClaimGuard(candidateText, keywords, output.newTerms);
    // The target role and company are fair game for numbers ("Engineer II"); the
    // posting is not — "4+ years" there is a requirement, not the candidate's.
    const numberSource = [candidateText, input.company, input.role].join(" ");
    const groundingSource = contentWords([candidateText, posting ?? "", input.company, input.role, input.recipientName ?? ""]);

    const { paragraphs, removed } = filterSentences(output.paragraphs, {
      isSupported: sentence => guard.isSupported(sentence, numberSource),
      grounding: { source: groundingSource, vocabulary: LETTER_VOCABULARY },
    });

    const body = paragraphs.join("\n\n");
    const normalizedBody = normalizeText(body);

    return {
      body,
      removed,
      paragraphCount: paragraphs.length,
      keptWords: body.split(/\s+/).filter(Boolean).length,
      addedTerms: guard.addedTerms.filter((entry: EvidencedTerm) => containsTerm(normalizedBody, entry.term)),
    };
  }
}
