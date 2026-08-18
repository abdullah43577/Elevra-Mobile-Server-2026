import { prisma } from "../src/lib/prisma";
import type { InterviewCategory } from "../src/generated/prisma/client";

/*
  The seeded question bank.

  Tagged by category, never by job title. Coverage per role would be an endless
  content treadmill that ships thin and goes stale, and the questions actually
  worth rehearsing are role-agnostic — behavioural, situational, motivation.
  Role-specific technical questions are the user's to add, or AI's to generate.

  Every question carries `guidance`: one line on what a strong answer covers.
  A bare question with no coaching is the browsable-bank failure mode this
  feature exists to avoid.

  `seedKey` is stable and unique, so re-running this updates rows in place
  rather than duplicating the catalogue.

  Run with: npx tsx prisma/seed-interview-questions.ts
*/

interface SeedQuestion {
  key: string;
  text: string;
  category: InterviewCategory;
  guidance: string;
}

const QUESTIONS: SeedQuestion[] = [
  // ─── Background ────────────────────────────────────────────────
  {
    key: "bg-tell-me-about-yourself",
    text: "Tell me about yourself.",
    category: "BACKGROUND",
    guidance:
      "Ninety seconds, present to past to future: what you do now, the two moves that got you here, why this role is the next one. Not your life story.",
  },
  {
    key: "bg-walk-through-cv",
    text: "Walk me through your CV.",
    category: "BACKGROUND",
    guidance:
      "A narrative, not a reading. Explain why each move happened and what it taught you. Address gaps plainly before they ask.",
  },
  {
    key: "bg-proudest-work",
    text: "What piece of work are you proudest of?",
    category: "BACKGROUND",
    guidance:
      "Pick something you can explain the impact of in a number or a clear outcome. Say what you specifically did, not what the team did.",
  },
  {
    key: "bg-day-to-day",
    text: "What does a typical day look like in your current role?",
    category: "BACKGROUND",
    guidance:
      "Show the shape of your responsibility — what you own, who you work with, what you decide alone. Avoid a task list.",
  },
  {
    key: "bg-career-decision",
    text: "Talk me through a career decision you made and why.",
    category: "BACKGROUND",
    guidance:
      "Shows judgement. Give the options you weighed and the reasoning, not just the outcome. It is fine if it did not work out.",
  },

  // ─── Behavioural (STAR) ────────────────────────────────────────
  {
    key: "beh-disagreed-manager",
    text: "Tell me about a time you disagreed with your manager.",
    category: "BEHAVIOURAL",
    guidance:
      "They are testing whether you can push back without being difficult. Show you raised it directly, argued with evidence, and committed to the decision either way.",
  },
  {
    key: "beh-failed",
    text: "Tell me about a time you failed.",
    category: "BEHAVIOURAL",
    guidance:
      "Pick a real failure with real consequences — a trivial one reads as evasion. Spend most of the answer on what you changed afterwards.",
  },
  {
    key: "beh-difficult-colleague",
    text: "Describe a time you had to work with someone difficult.",
    category: "BEHAVIOURAL",
    guidance:
      "Never make them the villain. Show you looked for the reason behind the friction and what you did to make the work possible anyway.",
  },
  {
    key: "beh-tight-deadline",
    text: "Tell me about a time you delivered under a tight deadline.",
    category: "BEHAVIOURAL",
    guidance:
      "The interesting part is what you cut and how you decided. Anyone can say they worked late.",
  },
  {
    key: "beh-changed-mind",
    text: "Tell me about a time new information made you change your mind.",
    category: "BEHAVIOURAL",
    guidance:
      "Be concrete about what the evidence was and how quickly you moved. Shows you hold opinions loosely.",
  },
  {
    key: "beh-influenced-without-authority",
    text: "Describe a time you influenced a decision without having authority.",
    category: "BEHAVIOURAL",
    guidance:
      "Name who you needed on side and what actually convinced them. Senior roles are mostly this.",
  },
  {
    key: "beh-mistake-owned",
    text: "Tell me about a mistake you made that affected other people.",
    category: "BEHAVIOURAL",
    guidance:
      "Say it plainly, say how you told them, say what you did to contain it. Ownership is the whole answer.",
  },
  {
    key: "beh-feedback-received",
    text: "Tell me about difficult feedback you received.",
    category: "BEHAVIOURAL",
    guidance:
      "Real feedback that stung, your honest first reaction, and the specific change that followed. A vague 'I improved' answer fails.",
  },
  {
    key: "beh-feedback-given",
    text: "Describe a time you gave someone difficult feedback.",
    category: "BEHAVIOURAL",
    guidance:
      "How you prepared, how you opened, and what happened after. The outcome matters more than the delivery.",
  },
  {
    key: "beh-juggled-priorities",
    text: "Tell me about a time you had too much on and had to prioritise.",
    category: "BEHAVIOURAL",
    guidance:
      "State the criteria you used and what you explicitly dropped. Saying you did it all is the wrong answer.",
  },
  {
    key: "beh-ambiguity",
    text: "Describe a project where the goal was unclear when you started.",
    category: "BEHAVIOURAL",
    guidance:
      "Show how you created clarity — who you asked, what you wrote down, what you shipped to learn.",
  },
  {
    key: "beh-persuaded-customer",
    text: "Tell me about a time you handled an unhappy customer or stakeholder.",
    category: "BEHAVIOURAL",
    guidance:
      "Lead with what you understood about their problem before what you did about it.",
  },
  {
    key: "beh-improved-process",
    text: "Tell me about something you improved that nobody asked you to.",
    category: "BEHAVIOURAL",
    guidance:
      "Shows initiative and judgement about what is worth fixing. Quantify the before and after if you can.",
  },
  {
    key: "beh-team-conflict",
    text: "Describe a conflict inside your team and your part in resolving it.",
    category: "BEHAVIOURAL",
    guidance:
      "Your part, specifically. Being a bystander who watched it resolve is not an answer.",
  },
  {
    key: "beh-learned-fast",
    text: "Tell me about a time you had to learn something quickly.",
    category: "BEHAVIOURAL",
    guidance:
      "How you learn is the point: what you read, who you asked, how you checked you had it right.",
  },
  {
    key: "beh-said-no",
    text: "Tell me about a time you said no to a request.",
    category: "BEHAVIOURAL",
    guidance:
      "The reasoning and how you offered an alternative. Shows you protect the work rather than just absorbing everything.",
  },
  {
    key: "beh-mentored",
    text: "Describe a time you helped someone else get better at their job.",
    category: "BEHAVIOURAL",
    guidance:
      "Specific person, specific gap, specific change. Works even without formal reports.",
  },

  // ─── Situational ───────────────────────────────────────────────
  {
    key: "sit-first-90-days",
    text: "What would your first 90 days in this role look like?",
    category: "SITUATIONAL",
    guidance:
      "Learn, then contribute, then own. Name what you would want to understand first and who you would talk to.",
  },
  {
    key: "sit-missed-deadline",
    text: "You realise a deadline will be missed. What do you do?",
    category: "SITUATIONAL",
    guidance:
      "Tell people early, with options and a revised date. The failure mode they are probing for is going quiet.",
  },
  {
    key: "sit-conflicting-instructions",
    text: "Two senior people give you conflicting instructions. What do you do?",
    category: "SITUATIONAL",
    guidance:
      "Get them in the same conversation rather than picking a side privately. Say how you would frame the trade-off.",
  },
  {
    key: "sit-disagree-with-approach",
    text: "You think the team is doing something the wrong way. How do you handle it?",
    category: "SITUATIONAL",
    guidance:
      "Understand why it is done that way first, then argue with evidence, then accept the call.",
  },
  {
    key: "sit-underperforming-peer",
    text: "A teammate is not pulling their weight. What do you do?",
    category: "SITUATIONAL",
    guidance:
      "Talk to them before escalating, and assume a cause you cannot see. Escalation is the last step, not the first.",
  },
  {
    key: "sit-no-information",
    text: "You are asked to start something with no brief and no owner. What do you do?",
    category: "SITUATIONAL",
    guidance:
      "Write your own brief and get it confirmed. Shows you can create structure rather than wait for it.",
  },
  {
    key: "sit-scope-creep",
    text: "A project keeps growing in scope. How do you respond?",
    category: "SITUATIONAL",
    guidance:
      "Make the cost visible and force a trade-off decision rather than silently absorbing it.",
  },

  // ─── Motivation ────────────────────────────────────────────────
  {
    key: "mot-why-this-role",
    text: "Why do you want this role?",
    category: "MOTIVATION",
    guidance:
      "Tie something specific in the job description to something specific you have done or want to do next. Generic enthusiasm is the most common failure in the whole interview.",
  },
  {
    key: "mot-why-this-company",
    text: "Why do you want to work here specifically?",
    category: "MOTIVATION",
    guidance:
      "Name something only true of this company — a product decision, a market position, something someone there wrote. Prove you looked.",
  },
  {
    key: "mot-why-leaving",
    text: "Why are you leaving your current role?",
    category: "MOTIVATION",
    guidance:
      "Frame it as moving towards something, not escaping something. Never criticise your current employer, however justified.",
  },
  {
    key: "mot-gap-in-cv",
    text: "Can you explain the gap in your employment?",
    category: "MOTIVATION",
    guidance:
      "State it directly and without apology, say what you did with the time, and move on. Discomfort is what makes it look like a problem.",
  },
  {
    key: "mot-five-years",
    text: "Where do you want to be in a few years?",
    category: "MOTIVATION",
    guidance:
      "A direction, not a job title. Make it plausible that this role is a step on that path.",
  },
  {
    key: "mot-what-motivates",
    text: "What kind of work energises you?",
    category: "MOTIVATION",
    guidance:
      "Be honest and specific — vague answers here read as someone who has not thought about their own career.",
  },
  {
    key: "mot-career-change",
    text: "Why are you changing field?",
    category: "MOTIVATION",
    guidance:
      "Lead with what transfers, not with what you are leaving. Name the parts of the new work you have already done.",
  },
  {
    key: "mot-other-offers",
    text: "Are you interviewing elsewhere?",
    category: "MOTIVATION",
    guidance:
      "Be honest without turning it into leverage this early. A short, calm answer is enough.",
  },

  // ─── Strengths and self-awareness ──────────────────────────────
  {
    key: "str-greatest-strength",
    text: "What is your greatest strength?",
    category: "STRENGTHS",
    guidance:
      "One strength, relevant to this job, plus the evidence. A list of three is a wasted answer.",
  },
  {
    key: "str-weakness",
    text: "What is your biggest weakness?",
    category: "STRENGTHS",
    guidance:
      "A real one you are actively working on, with the specific thing you now do differently. Disguised strengths are transparent and cost you credibility.",
  },
  {
    key: "str-colleagues-say",
    text: "How would your colleagues describe you?",
    category: "STRENGTHS",
    guidance:
      "Quote real feedback if you have it. Include something that is not purely flattering.",
  },
  {
    key: "str-manager-say",
    text: "What would your last manager say you need to work on?",
    category: "STRENGTHS",
    guidance:
      "They may check. Give the honest answer and what you have done since.",
  },
  {
    key: "str-work-style",
    text: "How do you like to be managed?",
    category: "STRENGTHS",
    guidance:
      "Concrete preferences — cadence, autonomy, how you like feedback. It is a fit question, so answer it honestly.",
  },
  {
    key: "str-stress",
    text: "How do you handle pressure?",
    category: "STRENGTHS",
    guidance:
      "Describe your actual mechanism, with an example. 'I work well under pressure' says nothing.",
  },
  {
    key: "str-not-good-at",
    text: "What part of the job description are you least prepared for?",
    category: "STRENGTHS",
    guidance:
      "Pick something genuine but not central, and say how you would close the gap. Claiming there is nothing reads as low self-awareness.",
  },

  // ─── Closing ───────────────────────────────────────────────────
  {
    key: "cls-questions-for-us",
    text: "Do you have any questions for us?",
    category: "CLOSING",
    guidance:
      "Always yes, and have four ready since some get answered earlier. Ask about the work and the team, not about perks.",
  },
  {
    key: "cls-success-in-role",
    text: "What does success look like in this role after a year?",
    category: "CLOSING",
    guidance:
      "One to ask them. Vague answers from the interviewer are a signal about the role worth noticing.",
  },
  {
    key: "cls-team-challenge",
    text: "What is the hardest problem the team is facing right now?",
    category: "CLOSING",
    guidance:
      "One to ask them. It gets an honest answer more often than any question about culture.",
  },
  {
    key: "cls-salary-expectations",
    text: "What are your salary expectations?",
    category: "CLOSING",
    guidance:
      "Have a researched range and a reason for it. Deflect once to ask their budget; if pressed, give the range rather than refusing.",
  },
  {
    key: "cls-notice-period",
    text: "When could you start?",
    category: "CLOSING",
    guidance:
      "Know your notice period exactly. Do not offer to break it — it tells them how you would treat them.",
  },
  {
    key: "cls-anything-else",
    text: "Is there anything else we should know about you?",
    category: "CLOSING",
    guidance:
      "Your last word. Use it for the strongest point you did not get to say, then stop talking.",
  },
];

const seedInterviewQuestions = async function () {
  console.log(`Seeding ${QUESTIONS.length} interview questions...`);

  for (const [index, question] of QUESTIONS.entries()) {
    const data = {
      text: question.text,
      category: question.category,
      guidance: question.guidance,
      sortOrder: index,
      isActive: true,
    };

    await prisma.interviewQuestion.upsert({
      where: { seedKey: question.key },
      create: { ...data, seedKey: question.key },
      update: data,
    });
  }

  const total = await prisma.interviewQuestion.count({ where: { userId: null } });
  console.log(`Done. ${total} questions in the catalogue.`);
};

seedInterviewQuestions()
  .catch((error) => {
    console.error("Seeding interview questions failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
