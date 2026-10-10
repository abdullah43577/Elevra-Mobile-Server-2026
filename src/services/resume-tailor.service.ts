import { createHash } from "node:crypto";
import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { BadRequestError, NotFoundError } from "../lib/errors";
import {
  computeCoverage,
  containsTerm,
  dedupeKeywords,
  normalizeText,
  numbersIn,
  resumeText,
  type JobKeyword,
  type KeywordCoverage,
} from "../lib/keyword-match";
import { CareerProfileRepository } from "../repositories/career-profile.repository";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import { ResumeRepository } from "../repositories/resume/resume.repository";
import { TemplateRepository } from "../repositories/resume/template.repository";
import { resumeDataSchema, type ResumeDataInput } from "../schemas/resume-data";

const MIN_JOB_DESCRIPTION_CHARS = 150;
const MAX_JOB_DESCRIPTION_CHARS = 12_000;
const TITLE_MAX = 100;

const KEYWORD_SYSTEM_PROMPT = `You read job postings the way an applicant tracking system and a recruiter screen them.
Extract the 10-25 most important screening keywords: hard skills, tools, technologies, methodologies, certifications, domain knowledge and key qualifications.
Write each in its shortest canonical form, phrased as the posting phrases it ("React", "SQL", "stakeholder management").
Mark required true for must-haves and false for nice-to-haves.
Exclude soft-skill cliches (team player, fast-paced), the company name, benefits and locations.
Reply with JSON only: {"keywords": [{"term": string, "required": boolean}]}`;

const TAILOR_SYSTEM_PROMPT = `You tailor a candidate's resume to one job posting. Breaking any rule below makes the output unusable.
1. Only rephrase, reorder and emphasise what the resume already says. Never add employers, job titles, dates, degrees, certifications, tools, skills, responsibilities or results the resume does not contain.
2. Never add or change a number. Every figure you write must already appear in that same resume entry.
3. Rewrite every bullet of an entry and return exactly as many as it has: never drop, merge or add one. Order them most relevant first.
4. A description is rewritten from that description's own content. Never replace it with the job title, company or dates.
5. Use the posting's exact keyword wherever the resume already shows the same thing in other words. When you use one of missingKeywords, add it to newTerms with evidence: an exact quote of a few words copied from the resume that proves it. Example: the resume says "wrote integration tests in Jest" and missingKeywords has "automated tests" -> write "automated tests" and add {"term": "automated tests", "evidence": "integration tests in Jest"}. No supporting quote, no keyword.
6. Bullets are concise and start with a strong verb.
7. summary is 2-3 sentences aimed at this role, built only from the resume.
Reply with JSON only:
{"summary": string, "experience": [{"index": number, "description": string, "achievements": string[]}], "skillOrder": string[], "projects": [{"index": number, "description": string}], "newTerms": [{"term": string, "evidence": string}]}
Only include description or achievements for an entry when the resume has them. skillOrder lists the resume's existing skill names, most relevant first.`;

const extractedKeywordsSchema = z.object({
  keywords: z
    .array(z.object({ term: z.string().trim().min(1).max(60), required: z.boolean() }))
    .min(1)
    .max(40),
});

const storedKeywordsSchema = z.array(z.object({ term: z.string(), required: z.boolean() }));

const tailoredOutputSchema = z.object({
  summary: z.string().max(1500).optional(),
  experience: z
    .array(z.object({ index: z.number().int(), description: z.string().optional(), achievements: z.array(z.string()).optional() }))
    .optional(),
  skillOrder: z.array(z.string()).optional(),
  projects: z.array(z.object({ index: z.number().int(), description: z.string() })).optional(),
  newTerms: z.array(z.object({ term: z.string(), evidence: z.string() })).optional(),
});

type TailoredOutput = z.infer<typeof tailoredOutputSchema>;

export interface TailorReport {
  before: KeywordCoverage;
  after: KeywordCoverage;
  changes: string[];
  addedTerms: { term: string; evidence: string }[];
  keptOriginal: number;
}

const hashJobDescription = function (text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
};

const parseSections = function (record: Record<string, unknown>): ResumeDataInput {
  const sections = ["personalInfo", "experience", "education", "skills", "languages", "certifications", "projects", "references"] as const;
  const input = Object.fromEntries(sections.map(key => [key, record[key] ?? undefined]));

  const parsed = resumeDataSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestError("This resume has data that could not be read for tailoring");
  return parsed.data;
};

// Prisma rejects a plain null for a Json column, so absent sections are omitted.
const sectionsForWrite = function (data: ResumeDataInput) {
  return {
    ...(data.personalInfo && { personalInfo: data.personalInfo }),
    ...(data.experience && { experience: data.experience }),
    ...(data.education && { education: data.education }),
    ...(data.skills && { skills: data.skills }),
    ...(data.languages && { languages: data.languages }),
    ...(data.certifications && { certifications: data.certifications }),
    ...(data.projects && { projects: data.projects }),
    ...(data.references && { references: data.references }),
  };
};

const MIN_CONTENT_OVERLAP = 0.35;
const STOPWORDS = new Set(["with", "that", "from", "this", "have", "using", "into", "over", "more", "than", "were", "been", "they", "their", "which", "also", "across", "while", "through", "within", "about", "when", "where"]);

const contentWords = function (texts: string[]) {
  return new Set(
    normalizeText(texts.join(" "))
      .split(" ")
      .filter(word => word.length >= 4 && !STOPWORDS.has(word)),
  );
};

// Catches a rewrite that drifted off its source — in testing, a model replaced a
// role's description with that role's own title and dates, which passes every
// other check.
const preservesContent = function (candidate: string[], original: string[]) {
  const words = contentWords(original);
  if (words.size < 3) return true;

  const kept = contentWords(candidate);
  let shared = 0;
  for (const word of words) if (kept.has(word)) shared++;
  return shared / words.size >= MIN_CONTENT_OVERLAP;
};

const sameText = function (a: string[] | undefined, b: string[] | undefined) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
};

/*
  The no-invention rule, enforced here rather than trusted to the prompt. Only
  text fields are taken from the model; company, position, dates and every
  other section are copied from the base. A rewritten field is discarded, and
  the original kept, when it:
    - contains a number its source entry does not,
    - uses a job keyword the base resume lacks without verified evidence — the
      model must quote existing resume text for every keyword it introduces,
      and the quote has to actually be there,
    - returns a different number of bullets (a dropped bullet is lost content), or
    - keeps too little of the original's wording to still be the same content.

  The change list is built here from what actually changed. In testing, a model
  asked to describe its own edits claimed keyword additions it had not made.
*/
export const applyTailoring = function (base: ResumeDataInput, output: TailoredOutput, keywords: JobKeyword[]) {
  const baseText = normalizeText(resumeText(base));

  const addedTerms = (output.newTerms ?? []).filter(
    entry => entry.term.trim() && entry.evidence.trim().length >= 2 && containsTerm(baseText, entry.evidence),
  );
  const allowed = new Set(addedTerms.map(entry => normalizeText(entry.term)));
  const blocked = keywords.filter(keyword => !containsTerm(baseText, keyword.term) && !allowed.has(normalizeText(keyword.term)));

  const isSafe = function (texts: string[], source: string) {
    const sourceNumbers = numbersIn(source);
    return texts.every(text => {
      const normalized = normalizeText(text);
      const inventsNumber = [...numbersIn(text)].some(number => !sourceNumbers.has(number));
      const usesBlockedTerm = blocked.some(keyword => containsTerm(normalized, keyword.term));
      return !inventsNumber && !usesBlockedTerm;
    });
  };

  let keptOriginal = 0;
  const changes: string[] = [];
  const result: ResumeDataInput = { ...base };

  const summary = output.summary?.trim();
  if (summary) {
    if (isSafe([summary], resumeText(base))) {
      result.personalInfo = { ...base.personalInfo, summary };
      changes.push(base.personalInfo?.summary?.trim() ? "Rewrote your summary for this role" : "Wrote a summary for this role from your experience");
    } else {
      keptOriginal++;
    }
  }

  const experienceRewrites = new Map((output.experience ?? []).map(entry => [entry.index, entry]));
  let rewordedRoles = 0;
  const experience = base.experience?.map((entry, index) => {
    const rewrite = experienceRewrites.get(index);
    if (!rewrite) return entry;

    const originalDescription = entry.description?.trim();
    const newDescription = rewrite.description?.trim();
    const description = originalDescription && newDescription ? newDescription : entry.description;

    const originalBullets = entry.achievements ?? [];
    const newBullets = (rewrite.achievements ?? []).map(line => line.trim()).filter(Boolean);
    const rewritesBullets = originalBullets.length > 0 && newBullets.length > 0;
    const achievements = rewritesBullets ? newBullets : entry.achievements;

    const source = [entry.position, entry.company, entry.description, ...originalBullets].join(" ");
    const acceptable =
      isSafe([description ?? "", ...(achievements ?? [])], source) &&
      (!rewritesBullets || (newBullets.length === originalBullets.length && preservesContent(newBullets, originalBullets))) &&
      (!originalDescription || !newDescription || preservesContent([newDescription], [originalDescription]));

    if (!acceptable) {
      keptOriginal++;
      return entry;
    }

    if (description !== entry.description || !sameText(achievements, entry.achievements)) rewordedRoles++;
    return {
      ...entry,
      ...(description !== undefined && { description }),
      ...(achievements !== undefined && { achievements }),
    };
  });
  if (experience) result.experience = experience;
  if (rewordedRoles) changes.push(`Reworded ${rewordedRoles === 1 ? "one role" : `${rewordedRoles} roles`} toward the posting`);

  if (base.skills?.length && output.skillOrder?.length) {
    const rank = new Map(output.skillOrder.map((name, position) => [normalizeText(name), position]));
    const skills = [...base.skills].sort(
      (a, b) => (rank.get(normalizeText(a.name)) ?? Infinity) - (rank.get(normalizeText(b.name)) ?? Infinity),
    );
    result.skills = skills;

    const movedUp = skills.slice(0, 3).filter((skill, position) => base.skills?.[position]?.name !== skill.name);
    if (movedUp.length) changes.push(`Moved ${movedUp.map(skill => skill.name).join(", ")} up your skills`);
  }

  const projectRewrites = new Map((output.projects ?? []).map(entry => [entry.index, entry.description.trim()]));
  let rewordedProjects = 0;
  const projects = base.projects?.map((entry, index) => {
    const description = projectRewrites.get(index);
    if (!description || !entry.description?.trim() || description === entry.description) return entry;

    const source = [entry.name, entry.description, ...(entry.technologies ?? [])].join(" ");
    if (!isSafe([description], source) || !preservesContent([description], [entry.description])) {
      keptOriginal++;
      return entry;
    }
    rewordedProjects++;
    return { ...entry, description };
  });
  if (projects) result.projects = projects;
  if (rewordedProjects) changes.push(`Reworded ${rewordedProjects === 1 ? "one project" : `${rewordedProjects} projects`}`);

  const finalText = normalizeText(resumeText(result));
  return {
    data: result,
    changes,
    keptOriginal,
    addedTerms: addedTerms.filter(entry => containsTerm(finalText, entry.term)),
  };
};

export class ResumeTailorService {
  private applicationRepo = new JobApplicationRepository();
  private resumeRepo = new ResumeRepository();
  private careerProfileRepo = new CareerProfileRepository();
  private templateRepo = new TemplateRepository();

  async tailorResume(applicationId: string, userId: string, baseResumeId?: string) {
    await assertPro(userId, PRO_FEATURES.AI_RESUME_TAILOR);

    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const jobDescription = application.jobDescription?.trim() ?? "";
    if (jobDescription.length < MIN_JOB_DESCRIPTION_CHARS) {
      throw new BadRequestError("Paste the job description into this application first. Tailoring works from the posting.");
    }

    const base = await this.resolveBase(userId, baseResumeId);

    // One quota unit per tailoring, though it can take two model calls.
    await consumeAiQuota(userId);

    const keywords = await this.ensureKeywords(application, jobDescription, userId);
    const before = computeCoverage(keywords, base.data);

    const { result } = await generateJson({
      system: TAILOR_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        job: {
          company: application.company,
          role: application.role,
          keywords: keywords.map(keyword => keyword.term),
          missingKeywords: before.missing.map(keyword => keyword.term),
          posting: jobDescription.slice(0, MAX_JOB_DESCRIPTION_CHARS),
        },
        resume: {
          headline: base.data.personalInfo?.title,
          summary: base.data.personalInfo?.summary,
          experience: (base.data.experience ?? []).map((entry, index) => ({
            index,
            position: entry.position,
            company: entry.company,
            description: entry.description,
            achievements: entry.achievements,
          })),
          skills: (base.data.skills ?? []).map(skill => skill.name),
          projects: (base.data.projects ?? []).map((entry, index) => ({
            index,
            name: entry.name,
            description: entry.description,
            technologies: entry.technologies,
          })),
          education: (base.data.education ?? []).map(entry => [entry.degree, entry.field].filter(Boolean).join(", ")),
          certifications: (base.data.certifications ?? []).map(cert => cert.name),
        },
      }),
      schema: tailoredOutputSchema,
      temperature: 0.3,
      reasoningEffort: "medium",
      maxTokens: 8192,
    });

    const tailored = applyTailoring(base.data, result, keywords);

    const resume = await this.resumeRepo.create({
      userId,
      title: `${application.company} – ${application.role}`.slice(0, TITLE_MAX),
      templateId: base.templateId,
      ...sectionsForWrite(tailored.data),
    });

    await this.applicationRepo.update(applicationId, userId, { resumeId: resume.id });

    const report: TailorReport = {
      before,
      after: computeCoverage(keywords, tailored.data),
      changes: tailored.changes,
      addedTerms: tailored.addedTerms,
      keptOriginal: tailored.keptOriginal,
    };

    return { resume, report };
  }

  // Free and model-free: scores the attached resume against keywords a
  // tailoring already extracted. Null when there is nothing current to score.
  async getMatch(applicationId: string, userId: string) {
    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const keywords = this.cachedKeywords(application);
    if (!application.resumeId || !keywords) return null;

    const resume = await this.resumeRepo.findById(application.resumeId, userId);
    if (!resume) return null;

    return { resumeId: resume.id, coverage: computeCoverage(keywords, parseSections(resume)) };
  }

  private cachedKeywords(application: { jobDescription: string | null; jobKeywords: unknown; jobKeywordsHash: string | null }) {
    const jobDescription = application.jobDescription?.trim();
    if (!jobDescription || application.jobKeywordsHash !== hashJobDescription(jobDescription)) return null;

    const parsed = storedKeywordsSchema.safeParse(application.jobKeywords);
    return parsed.success && parsed.data.length ? parsed.data : null;
  }

  private async ensureKeywords(
    application: { id: string; jobDescription: string | null; jobKeywords: unknown; jobKeywordsHash: string | null },
    jobDescription: string,
    userId: string,
  ) {
    const cached = this.cachedKeywords(application);
    if (cached) return cached;

    const { result } = await generateJson({
      system: KEYWORD_SYSTEM_PROMPT,
      prompt: jobDescription.slice(0, MAX_JOB_DESCRIPTION_CHARS),
      schema: extractedKeywordsSchema,
      temperature: 0.1,
      reasoningEffort: "low",
    });

    const keywords = dedupeKeywords(result.keywords);
    await this.applicationRepo.updateJobKeywords(application.id, userId, keywords.map(keyword => ({ ...keyword })), hashJobDescription(jobDescription));
    return keywords;
  }

  private async resolveBase(userId: string, baseResumeId?: string) {
    if (baseResumeId) {
      const resume = await this.resumeRepo.findById(baseResumeId, userId);
      if (!resume) throw new NotFoundError("Resume not found");
      return this.assertTailorable({ data: parseSections(resume), templateId: resume.templateId });
    }

    const profile = await this.careerProfileRepo.findByUser(userId);
    if (!profile) throw new BadRequestError("Set up your career profile first, or tailor from one of your resumes.");

    const templateId = (await this.resumeRepo.findLatestTemplateId(userId)) ?? (await this.defaultTemplateId());
    return this.assertTailorable({ data: parseSections(profile), templateId });
  }

  private assertTailorable<T extends { data: ResumeDataInput }>(base: T) {
    if (!base.data.experience?.length) {
      throw new BadRequestError("Add at least one work experience entry first. Tailoring rewrites your experience for the role.");
    }
    return base;
  }

  private async defaultTemplateId() {
    const templates = await this.templateRepo.findMany();
    const template = templates.find(entry => entry.layoutKey === "ATS_CLEAN") ?? templates[0];
    if (!template) throw new Error("No active resume templates are seeded");
    return template.id;
  }
}
