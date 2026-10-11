import type { InterviewCategory } from "../generated/prisma/client";
import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { AiUnavailableError, BadRequestError, NotFoundError } from "../lib/errors";
import { containsTerm, normalizeText, numbersIn, resumeText } from "../lib/keyword-match";
import { InterviewPrepRepository } from "../repositories/interview-prep.repository";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import { CandidateSourceService } from "./candidate-source.service";
import { JobKeywordService, MAX_JOB_DESCRIPTION_CHARS } from "./job-keyword.service";

const MIN_JOB_DESCRIPTION_CHARS = 150;
const MIN_USABLE_QUESTIONS = 3;

const GENERATE_SYSTEM_PROMPT = `You prepare a candidate for one specific job interview by writing the questions this interviewer is most likely to ask.
Write 8 questions:
- 3 or 4 ROLE_SPECIFIC, about the actual work in the posting: its tools, responsibilities and problems ("How would you…", "Walk me through how you'd…").
- 2 BEHAVIOURAL ("Tell me about a time…") aimed at the posting's main responsibilities.
- 1 or 2 BACKGROUND that dig into something specific in the resume that this role cares about. Only when a resume is given.
- 1 MOTIVATION about this role or company, using only what the posting says.
Rules:
1. Every question comes from the posting or the resume. Give source ("posting" or "resume") and quote: an exact phrase of a few words copied from that source, which the question is about.
2. Never presume experience the resume does not show. A question about the candidate's past must be about something in their resume.
3. No generic questions every interview asks (tell me about yourself, strengths and weaknesses, where do you see yourself in five years). The candidate already has those.
4. Do not repeat anything in alreadyPinned.
5. guidance: one line, under 160 characters, on what a strong answer covers for this role.
Reply with JSON only: {"questions": [{"text": string, "category": "ROLE_SPECIFIC" | "BEHAVIOURAL" | "BACKGROUND" | "MOTIVATION" | "SITUATIONAL", "guidance": string, "source": "posting" | "resume", "quote": string}]}`;

const generatedSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(10).max(400),
        category: z.enum(["ROLE_SPECIFIC", "BEHAVIOURAL", "BACKGROUND", "MOTIVATION", "SITUATIONAL"]),
        guidance: z.string().trim().optional(),
        source: z.enum(["posting", "resume"]),
        quote: z.string().trim(),
      }),
    )
    .min(1)
    .max(15),
});

type GeneratedQuestion = z.infer<typeof generatedSchema>["questions"][number];

export const groundQuestions = function (questions: GeneratedQuestion[], sources: { posting: string; resume: string | null; names: string }) {
  const posting = normalizeText(sources.posting);
  const resume = sources.resume ? normalizeText(sources.resume) : null;
  const knownNumbers = numbersIn([sources.posting, sources.resume ?? "", sources.names].join(" "));

  const kept: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const question of questions) {
    const source = question.source === "resume" ? resume : posting;
    const quoted = !!source && question.quote.length >= 3 && containsTerm(source, question.quote);
    const inventsNumber = [...numbersIn(question.text)].some(number => !knownNumbers.has(number));
    const key = normalizeText(question.text);

    if (!quoted || inventsNumber || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    kept.push(question);
  }

  return { kept, dropped };
};

export class InterviewQuestionGenerationService {
  private applicationRepo = new JobApplicationRepository();
  private prepRepo = new InterviewPrepRepository();
  private keywordService = new JobKeywordService();
  private candidateSource = new CandidateSourceService();

  async generateForApplication(userId: string, applicationId: string) {
    await assertPro(userId, PRO_FEATURES.AI_INTERVIEW_QUESTIONS);

    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const posting = application.jobDescription?.trim() ?? "";
    if (posting.length < MIN_JOB_DESCRIPTION_CHARS) {
      throw new BadRequestError("Paste the job description into this application first. The questions are written from it.");
    }

    const candidate = await this.candidateSource.find(userId, application.resumeId ?? null);
    const visible = await this.prepRepo.findQuestions(userId);
    const pinned = await this.prepRepo.findQuestions(userId, { applicationId });

    await consumeAiQuota(userId);

    const keywords = await this.keywordService.ensure(application, userId);
    const resume = candidate ? resumeText(candidate.data) : null;
    const postingExcerpt = posting.slice(0, MAX_JOB_DESCRIPTION_CHARS);

    const { result } = await generateJson({
      system: GENERATE_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        role: application.role,
        company: application.company,
        posting: postingExcerpt,
        keywords: keywords.map(keyword => keyword.term),
        ...(resume && { resume }),
        alreadyPinned: pinned.map(question => question.text),
      }),
      schema: generatedSchema,
      temperature: 0.4,
      reasoningEffort: "medium",
    });

    const { kept, dropped } = groundQuestions(result.questions, {
      posting: postingExcerpt,
      resume,
      names: `${application.company} ${application.role}`,
    });

    const visibleByText = new Map(visible.map(question => [normalizeText(question.text), question.id]));
    const pinnedIds = new Set(pinned.map(question => question.id));

    const toCreate: { text: string; category: InterviewCategory; guidance?: string }[] = [];
    const existingToPin: string[] = [];

    for (const question of kept) {
      const existingId = visibleByText.get(normalizeText(question.text));
      if (existingId) {
        if (!pinnedIds.has(existingId)) existingToPin.push(existingId);
        continue;
      }
      toCreate.push({
        text: question.text,
        category: question.category,
        ...(question.guidance && { guidance: question.guidance.slice(0, 300) }),
      });
    }

    if (toCreate.length + existingToPin.length < MIN_USABLE_QUESTIONS) {
      throw new AiUnavailableError("Couldn't write questions grounded in this posting. Please try again.");
    }

    const created = await this.prepRepo.createAndPinQuestions(userId, applicationId, toCreate, existingToPin);

    return { questions: created, pinnedExisting: existingToPin.length, dropped };
  }
}
