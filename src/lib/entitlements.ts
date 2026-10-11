import type { SubscriptionTier } from "../generated/prisma/client";
import { PaymentRequiredError } from "./errors";
import { prisma } from "./prisma";

export const PRO_FEATURES = {
  AI_NOTE_SUMMARY: "ai_note_summary",
  AI_RESUME_TAILOR: "ai_resume_tailor",
  AI_COVER_LETTER: "ai_cover_letter",
  AI_INTERVIEW_QUESTIONS: "ai_interview_questions",
  AI_ANSWER_COACHING: "ai_answer_coaching",
  AI_MESSAGE_DRAFTS: "ai_message_drafts",
  VOICE_TRANSCRIPTION: "voice_transcription",
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

export const getUserTier = async function (userId: string): Promise<SubscriptionTier> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { subscriptionTier: true },
  });

  return settings?.subscriptionTier ?? "FREE";
};

// Call from the service layer, not the controller: a controller guard is bypassed
// the moment a second route points at the same service method.
export const assertPro = async function (userId: string, feature: ProFeature) {
  const tier = await getUserTier(userId);

  if (tier !== "PRO") {
    throw new PaymentRequiredError(FEATURE_MESSAGES[feature]);
  }

  return tier;
};

const FEATURE_MESSAGES: Record<ProFeature, string> = {
  [PRO_FEATURES.AI_NOTE_SUMMARY]: "AI summaries require Elevra Pro",
  [PRO_FEATURES.AI_RESUME_TAILOR]: "Tailoring a resume to a job requires Elevra Pro",
  [PRO_FEATURES.AI_COVER_LETTER]: "Drafting a cover letter with AI requires Elevra Pro",
  [PRO_FEATURES.AI_INTERVIEW_QUESTIONS]: "Interview questions for a specific job require Elevra Pro",
  [PRO_FEATURES.AI_ANSWER_COACHING]: "Feedback on your recorded answers requires Elevra Pro",
  [PRO_FEATURES.AI_MESSAGE_DRAFTS]: "Drafting follow-up and thank-you emails requires Elevra Pro",
  [PRO_FEATURES.VOICE_TRANSCRIPTION]: "Voice transcription requires Elevra Pro",
};
