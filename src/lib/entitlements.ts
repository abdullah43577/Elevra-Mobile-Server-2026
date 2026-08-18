import type { SubscriptionTier } from "../generated/prisma/client";
import { PaymentRequiredError } from "./errors";
import { prisma } from "./prisma";

/*
  What Pro actually buys. Kept in one place so the answer to "is this paid?" is
  never spread across call sites.

  The principle: users pay for what costs us money (AI inference) or for the
  finished deliverable (the exported PDF). Building is always free — capping
  notes, recordings, applications, or resumes makes the app feel broken rather
  than limited, and drives uninstalls instead of upgrades.

  Templates are deliberately NOT gated. The catalogue was built around ATS
  quality; charging for some of it means knowingly handing free users a worse
  resume, and export is already the gate.
*/
export const PRO_FEATURES = {
  RESUME_EXPORT: "resume_export",
  COVER_LETTER_EXPORT: "cover_letter_export",
  AI_NOTE_SUMMARY: "ai_note_summary",
  AI_REWRITER: "ai_rewriter",
  AI_CHAT: "ai_chat",
  AI_CAREER_TOOLS: "ai_career_tools",
  AI_RESUME_BUILDER: "ai_resume_builder",
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
  [PRO_FEATURES.RESUME_EXPORT]: "Exporting a resume as PDF requires Elevra Pro",
  [PRO_FEATURES.COVER_LETTER_EXPORT]: "Exporting a cover letter as PDF requires Elevra Pro",
  [PRO_FEATURES.AI_NOTE_SUMMARY]: "AI summaries require Elevra Pro",
  [PRO_FEATURES.AI_REWRITER]: "The AI rewriter requires Elevra Pro",
  [PRO_FEATURES.AI_CHAT]: "AI chat requires Elevra Pro",
  [PRO_FEATURES.AI_CAREER_TOOLS]: "Career tools require Elevra Pro",
  [PRO_FEATURES.AI_RESUME_BUILDER]: "The AI resume builder requires Elevra Pro",
  [PRO_FEATURES.VOICE_TRANSCRIPTION]: "Voice transcription requires Elevra Pro",
};
