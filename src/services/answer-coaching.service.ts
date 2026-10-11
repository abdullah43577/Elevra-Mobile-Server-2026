import { z } from "zod";
import { generateJson, transcribe } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { AppError, BadRequestError, NoSpeechError, NotFoundError } from "../lib/errors";
import { contentWords, groundedShare, normalizeText, numbersIn } from "../lib/keyword-match";
import { fetchStoredAudio } from "../lib/remote-audio";
import { InterviewPrepRepository } from "../repositories/interview-prep.repository";

const MIN_WORDS = 5;
const MIN_REWRITE_GROUNDING = 0.7;

// Whisper tidies disfluencies away unless its prompt is itself disfluent — and
// the filler count is half the point of coaching.
export const FILLER_PRESERVING_PROMPT = "Umm, let me think like, hmm... Okay, so, uh, here's what I, you know, did.";

// "like" and "actually" are left out: in most sentences they carry meaning.
const FILLERS = ["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm", "you know", "i mean", "basically", "literally", "kind of", "sort of"];

const COACH_SYSTEM_PROMPT = `You coach a candidate on one recorded interview answer. You get the question, its category, and a transcript of what they said.
Return JSON with:
- structure: for BEHAVIOURAL, BACKGROUND or SITUATIONAL questions set applies: true and say whether the answer covers situation, task, action and result (booleans). Otherwise set applies: false.
- specificity: "concrete" (names real actions, tools and outcomes), "mixed", or "vague".
- strongest: one sentence on the best thing in the answer.
- biggestFix: one sentence on the single change that would improve it most.
- tighterVersion: the same answer rewritten tighter in the first person, using only what the candidate said — no new facts, numbers or claims — without filler words, under 120 words.
Speak to the candidate as "you". Reply with JSON only:
{"structure": {"applies": boolean, "situation": boolean, "task": boolean, "action": boolean, "result": boolean}, "specificity": string, "strongest": string, "biggestFix": string, "tighterVersion": string}`;

const critiqueSchema = z.object({
  structure: z.object({
    applies: z.boolean(),
    situation: z.boolean().optional(),
    task: z.boolean().optional(),
    action: z.boolean().optional(),
    result: z.boolean().optional(),
  }),
  specificity: z.enum(["concrete", "mixed", "vague"]),
  strongest: z.string().trim().min(1).max(400),
  biggestFix: z.string().trim().min(1).max(400),
  tighterVersion: z.string().trim().optional(),
});

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const measureTake = function (transcript: string, durationSeconds: number | null) {
  const normalized = normalizeText(transcript);
  const words = normalized.trim().split(" ").filter(Boolean);

  const fillers = FILLERS.map(filler => {
    const needle = escapeRegExp(normalizeText(filler).trim());
    return { word: filler, count: (normalized.match(new RegExp(`(?<= )${needle}(?= )`, "g")) ?? []).length };
  })
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : null;
  const wordsPerMinute = duration && duration >= 5 ? Math.round(words.length / (duration / 60)) : null;

  return {
    wordCount: words.length,
    durationSeconds: duration,
    wordsPerMinute,
    pace: wordsPerMinute === null ? null : wordsPerMinute < 110 ? "slow" : wordsPerMinute > 170 ? "fast" : "steady",
    fillerCount: fillers.reduce((total, entry) => total + entry.count, 0),
    fillers,
    length: duration === null ? null : duration < 30 ? "short" : duration <= 120 ? "good" : duration <= 180 ? "long" : "too_long",
  };
};

export const isFaithfulRewrite = function (rewrite: string, transcript: string) {
  const spokenNumbers = numbersIn(transcript);
  if ([...numbersIn(rewrite)].some(number => !spokenNumbers.has(number))) return false;
  return groundedShare([rewrite], contentWords([transcript])) >= MIN_REWRITE_GROUNDING;
};

export class AnswerCoachingService {
  private prepRepo = new InterviewPrepRepository();

  async coachAnswer(userId: string, questionId: string) {
    await assertPro(userId, PRO_FEATURES.AI_ANSWER_COACHING);

    const question = await this.prepRepo.findQuestionById(questionId, userId);
    if (!question) throw new NotFoundError("Question not found");

    const answer = question.answers[0];
    if (!answer?.audioUrl) throw new BadRequestError("Record a take first. Coaching works from what you said out loud.");
    if (answer.transcript && answer.feedback) return answer;

    const audioUrl = answer.audioUrl;
    const audio = await fetchStoredAudio(audioUrl);

    await consumeAiQuota(userId);

    const transcript = await transcribe(audio.bytes, { filename: audio.filename, prompt: FILLER_PRESERVING_PROMPT });
    const metrics = measureTake(transcript, answer.audioDuration);
    if (metrics.wordCount < MIN_WORDS) throw new NoSpeechError();

    const { result } = await generateJson({
      system: COACH_SYSTEM_PROMPT,
      prompt: JSON.stringify({ question: question.text, category: question.category, guidance: question.guidance, transcript }),
      schema: critiqueSchema,
      temperature: 0.3,
      reasoningEffort: "medium",
    });

    const { tighterVersion, ...critique } = result;
    const feedback = {
      ...critique,
      metrics,
      ...(tighterVersion && isFaithfulRewrite(tighterVersion, transcript) && { tighterVersion }),
      generatedAt: new Date().toISOString(),
    };

    const saved = await this.prepRepo.saveCoachingForTake(userId, questionId, audioUrl, { transcript, feedback });
    if (!saved) throw new AppError("You recorded a new take while that one was being reviewed. Get feedback on the new one.", 409, "TAKE_REPLACED");

    const updated = await this.prepRepo.findQuestionById(questionId, userId);
    return updated?.answers[0] ?? answer;
  }
}
