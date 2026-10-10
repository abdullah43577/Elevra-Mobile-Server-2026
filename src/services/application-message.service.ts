import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { AiUnavailableError, NotFoundError } from "../lib/errors";
import { contentWords, numbersIn, resumeText } from "../lib/keyword-match";
import { filterSentences, LETTER_VOCABULARY } from "../lib/sentence-guard";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import { UserRepository } from "../repositories/user.repository";
import type { DraftMessageInput, MessageKind } from "../schemas/job-application";
import { CandidateSourceService } from "./candidate-source.service";

interface KindSpec {
  brief: string;
  subject: (role: string) => string;
  /*
    Whether the message draws on the application's notes, voice memos and the
    resume — and is therefore grounded against them, sentence by sentence.
  */
  usesContext: boolean;
  // A draft that does not do this has failed its one job.
  action: RegExp;
}

/*
  Two shapes of message. A follow-up or a thank-you is about the substance of
  the application, so it gets the context and the grounding. Accepting,
  negotiating, declining and answering a rejection are courtesy around one
  action, with no facts to ground: given the context, the model rehashed the
  interview in every one of them; grounded, the filter stripped the very
  sentence that accepted or declined. Those get only the names and the user's
  own points, and a check that the action is actually there.
*/
const KINDS: Record<MessageKind, KindSpec> = {
  FOLLOW_UP: {
    brief:
      "A short, polite follow-up on an application with no reply yet: restate interest in the role, at most one line on fit drawn from the candidate's material, and ask about next steps.",
    subject: role => `Following up — ${role} application`,
    usesContext: true,
    action: /follow(ing)? up|next steps|any update|an update|hear (back|from you)|where things stand/i,
  },
  THANK_YOU: {
    brief:
      "A thank-you after an interview: thank them for their time, mention one or two topics that were discussed and restate interest. Name topics only as the notes and transcript describe them, and never attribute a view, plan or decision to the interviewer that the notes do not state.",
    subject: role => `Thank you — ${role} interview`,
    usesContext: true,
    action: /\bthank/i,
  },
  ACCEPT_OFFER: {
    brief:
      "Say clearly that you accept the offer, that you are glad to, and ask what the next steps are. State no start date, salary or other term unless the points give it.",
    subject: role => `Accepting the ${role} offer`,
    usesContext: false,
    action: /\baccept(ing)?\b/i,
  },
  NEGOTIATE_OFFER: {
    brief:
      "Thank them, say you are excited about the offer, and ask to discuss the compensation package before you accept. Name no figure unless the points give one.",
    subject: role => `${role} offer`,
    usesContext: false,
    action: /compensation|salary|package|\bpay\b|terms/i,
  },
  DECLINE_OFFER: {
    brief: "Say clearly that you are declining the offer, thank them for their time, and leave the door open. Give no reason unless the points give one.",
    subject: role => `${role} offer`,
    usesContext: false,
    action: /\bdeclin(e|ing)\b|not (be )?(able to )?accept|turn(ing)? down/i,
  },
  REJECTION_REPLY: {
    brief: "Reply graciously to a rejection: thank them for letting you know, ask whether they would share any feedback, and ask to be considered for future roles.",
    subject: role => `Re: ${role} application`,
    usesContext: false,
    action: /feedback/i,
  },
};

const MESSAGE_SYSTEM_PROMPT = `You write one short email from a job candidate, in the first person, using only the facts provided.
- Do what the purpose says, plainly and early in the email.
- Never invent anything: no topics, names, dates, numbers, terms or reasons that are not in the input.
- 2 or 3 short paragraphs, under 130 words in total. Warm, plain and specific; no cliches and no flattery.
- No greeting and no sign-off — those are added separately.
Reply with JSON only: {"paragraphs": string[]}`;

const messageSchema = z.object({ paragraphs: z.array(z.string()).min(1).max(5) });

/*
  The polite vocabulary of a short work email, on top of the letter's, ignored
  when measuring grounding — "I hope you're well and wanted to follow up" names
  nothing that could be invented.
*/
const MESSAGE_VOCABULARY: ReadonlySet<string> = new Set([
  ...LETTER_VOCABULARY,
  "hope", "hoping", "follow", "following", "wanted", "update", "updates", "hear", "hearing", "regarding", "about",
  "interview", "interviewing", "speaking", "spoke", "decision", "decisions", "appreciate", "appreciated", "grateful",
  "consideration", "considered", "considering", "touch", "wishes", "regards", "kind", "kindly", "still", "discuss",
  "steps", "process", "share", "future", "enjoyed", "enjoy", "today", "yesterday", "week", "earlier", "again", "glad",
  "insight", "insights", "learning", "learn", "learned", "back", "submitted", "since", "reaching", "reach", "remain",
  "where", "things", "stand", "status",
]);

const firstName = (name: string) => name.trim().split(/\s+/)[0];

export class ApplicationMessageService {
  private applicationRepo = new JobApplicationRepository();
  private userRepo = new UserRepository();
  private candidateSource = new CandidateSourceService();

  /*
    A draft only. Nothing is sent from the server — Resend stays transactional
    — the client shares it or opens the user's own mail app. Subject lines are
    templated, not generated: there is nothing for a model to add to "Thank
    you — Backend Engineer interview".
  */
  async draft(userId: string, applicationId: string, input: DraftMessageInput) {
    await assertPro(userId, PRO_FEATURES.AI_MESSAGE_DRAFTS);

    const spec = KINDS[input.kind];
    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const candidate = await this.candidateSource.find(userId, application.resumeId ?? null);
    const transcripts = spec.usesContext ? await this.applicationRepo.findLinkedTranscripts(applicationId, userId) : [];
    const sender = await this.senderName(userId, candidate?.data.personalInfo);

    await consumeAiQuota(userId);

    const context = spec.usesContext
      ? {
          ...(application.notes && { applicationNotes: application.notes }),
          ...(transcripts.length && { voiceMemoTranscripts: transcripts }),
          ...(candidate && { candidateBackground: resumeText(candidate.data).slice(0, 4000) }),
          ...(application.jobDescription && { posting: application.jobDescription.slice(0, 4000) }),
        }
      : {};

    const sources = [
      application.company,
      application.role,
      input.interviewerName ?? "",
      input.points ?? "",
      ...(spec.usesContext
        ? [application.notes ?? "", application.jobDescription ?? "", ...transcripts, candidate ? resumeText(candidate.data) : ""]
        : []),
    ].join("\n");
    const sourceNumbers = numbersIn(sources);
    const grounding = spec.usesContext ? { source: contentWords([sources]), vocabulary: MESSAGE_VOCABULARY } : undefined;

    const request = {
      purpose: spec.brief,
      company: application.company,
      role: application.role,
      ...(input.interviewerName && { interviewer: input.interviewerName }),
      ...(input.points && { pointsFromCandidate: input.points }),
      ...context,
    };

    const write = async (extra: object = {}) => {
      const { result } = await generateJson({
        system: MESSAGE_SYSTEM_PROMPT,
        prompt: JSON.stringify({ ...request, ...extra }),
        schema: messageSchema,
        temperature: 0.4,
        reasoningEffort: "low",
      });
      return filterSentences(result.paragraphs, {
        isSupported: sentence => [...numbersIn(sentence)].every(number => sourceNumbers.has(number)),
        ...(grounding && { grounding }),
      });
    };

    let message = await write();
    if (!spec.action.test(message.paragraphs.join(" "))) {
      message = await write({ reminder: `The previous draft did not do what the purpose asks. ${spec.brief}` });
    }
    if (!message.paragraphs.length || !spec.action.test(message.paragraphs.join(" "))) {
      throw new AiUnavailableError("Couldn't write that message properly. Please try again.");
    }

    const greeting = input.interviewerName ? `Hi ${firstName(input.interviewerName)},` : "Hello,";
    const signOff = sender ? `Best regards,\n${sender}` : "Best regards,";

    return {
      kind: input.kind,
      subject: spec.subject(application.role),
      body: [greeting, ...message.paragraphs, signOff].join("\n\n"),
      removedSentences: message.removed.length,
    };
  }

  private async senderName(userId: string, personalInfo?: { firstName?: string | undefined; lastName?: string | undefined }) {
    const fromProfile = [personalInfo?.firstName, personalInfo?.lastName].filter(Boolean).join(" ");
    if (fromProfile) return fromProfile;

    const user = await this.userRepo.findById(userId, { first_name: true, last_name: true });
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  }
}
