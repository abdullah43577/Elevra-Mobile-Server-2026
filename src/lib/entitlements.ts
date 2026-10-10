import type { SubscriptionTier } from "../generated/prisma/client";
import { PaymentRequiredError } from "./errors";
import { prisma } from "./prisma";

/*
  What Pro actually buys. Kept in one place so the answer to "is this paid?" is
  never spread across call sites.

  The principle: users pay for what costs us money — AI inference. Building
  and exporting are free: capping notes, recordings, applications or resumes
  makes the app feel broken rather than limited, and charging to download your
  own file reads as a hostage fee when every free editor does it. New users try
  Pro through the store's free trial, not through a counter here.

  Templates are deliberately NOT gated. The catalogue was built around ATS
  quality; charging for some of it means knowingly handing free users a worse
  resume.
*/
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

  // No settings row yet means a brand-new account, which is FREE.
  return settings?.subscriptionTier ?? "FREE";
};

/*
  Call this from the SERVICE layer, not the controller. A controller guard is
  bypassed the moment someone points a second route at the same service method;
  a service guard cannot be.
*/
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
