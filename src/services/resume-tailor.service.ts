import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { buildClaimGuard, computeCoverage, containsTerm, contentWords, groundedShare, normalizeText, resumeText, type JobKeyword, type KeywordCoverage } from "../lib/keyword-match";
import { parseSections } from "../lib/resume-sections";
import { CareerProfileRepository } from "../repositories/career-profile.repository";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import { ResumeRepository } from "../repositories/resume/resume.repository";
import { TemplateRepository } from "../repositories/resume/template.repository";
import type { ResumeDataInput } from "../schemas/resume-data";
import { JobKeywordService, MAX_JOB_DESCRIPTION_CHARS } from "./job-keyword.service";

const MIN_JOB_DESCRIPTION_CHARS = 150;
const TITLE_MAX = 100;

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

const preservesContent = function (candidate: string[], original: string[]) {
  if (contentWords(original).size < 3) return true;
  return groundedShare(original, contentWords(candidate)) >= MIN_CONTENT_OVERLAP;
};

const sameText = function (a: string[] | undefined, b: string[] | undefined) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
};

// The no-invention rule is enforced here, not trusted to the prompt: a rewritten field that
// fails any check is discarded and the original kept.
export const applyTailoring = function (base: ResumeDataInput, output: TailoredOutput, keywords: JobKeyword[]) {
  const guard = buildClaimGuard(resumeText(base), keywords, output.newTerms);
  const isSafe = function (texts: string[], source: string) {
    return texts.every(text => guard.isSupported(text, source));
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
    addedTerms: guard.addedTerms.filter(entry => containsTerm(finalText, entry.term)),
  };
};

export class ResumeTailorService {
  private applicationRepo = new JobApplicationRepository();
  private resumeRepo = new ResumeRepository();
  private careerProfileRepo = new CareerProfileRepository();
  private templateRepo = new TemplateRepository();
  private keywordService = new JobKeywordService();

  async tailorResume(applicationId: string, userId: string, baseResumeId?: string) {
    await assertPro(userId, PRO_FEATURES.AI_RESUME_TAILOR);

    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const jobDescription = application.jobDescription?.trim() ?? "";
    if (jobDescription.length < MIN_JOB_DESCRIPTION_CHARS) {
      throw new BadRequestError("Paste the job description into this application first. Tailoring works from the posting.");
    }

    const base = await this.resolveBase(userId, baseResumeId);

    await consumeAiQuota(userId);

    const keywords = await this.keywordService.ensure(application, userId);
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

  async getMatch(applicationId: string, userId: string) {
    const application = await this.applicationRepo.findById(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");

    const keywords = this.keywordService.getCurrent(application);
    if (!application.resumeId || !keywords) return null;

    const resume = await this.resumeRepo.findById(application.resumeId, userId);
    if (!resume) return null;

    return { resumeId: resume.id, coverage: computeCoverage(keywords, parseSections(resume)) };
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
