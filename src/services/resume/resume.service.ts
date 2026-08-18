import { assertPro, PRO_FEATURES } from "../../lib/entitlements";
import { ResumeRepository } from "../../repositories/resume/resume.repository";
import { TemplateService } from "./template.service";
import { BadRequestError, NotFoundError } from "../../lib/errors";

const TITLE_MAX = 100;

/*
  "Tailored CV" -> "Tailored CV (Copy)" -> "Tailored CV (Copy 2)".

  Duplicating a duplicate is the common case, not the edge one — that is the
  whole point of the feature — so plain suffixing would leave people with
  "(Copy) (Copy) (Copy)" by the third role they applied to.
*/
const nextCopyTitle = function (title: string) {
  const match = title.match(/^(.*) \(Copy(?: (\d+))?\)$/);

  const base = match?.[1] ?? title;
  const nextIndex = match ? Number(match[2] ?? 1) + 1 : 1;
  const suffix = nextIndex === 1 ? " (Copy)" : ` (Copy ${nextIndex})`;

  // The column caps at 100, and the suffix is what carries the meaning, so the
  // base is what gets trimmed.
  return `${base.slice(0, TITLE_MAX - suffix.length).trim()}${suffix}`;
};

export class ResumeService {
  private resumeRepo = new ResumeRepository();
  private templateService = new TemplateService();

  async getResumes(userId: string) {
    return this.resumeRepo.findManyByUser(userId);
  }

  async getResumeById(resumeId: string, userId: string) {
    const resume = await this.resumeRepo.findById(resumeId, userId);
    if (!resume) {
      throw new NotFoundError("Resume not found");
    }
    return resume;
  }

  async createResume(
    userId: string,
    data: {
      title: string;
      templateId: string;
      personalInfo?: any;
      experience?: any;
      education?: any;
      skills?: any;
      languages?: any;
      certifications?: any;
      projects?: any;
      references?: any;
    },
  ) {
    // Validate template exists
    await this.templateService.getTemplateById(data.templateId);

    if (!data.title.trim()) {
      throw new BadRequestError("Resume title is required");
    }

    return this.resumeRepo.create({
      userId,
      title: data.title.trim(),
      templateId: data.templateId,
      personalInfo: data.personalInfo,
      experience: data.experience,
      education: data.education,
      skills: data.skills,
      languages: data.languages,
      certifications: data.certifications,
      projects: data.projects,
      references: data.references,
    });
  }

  /*
    Deliberately free, not Pro. Building is always free and only the finished
    PDF is paid (§12) — and one tailored resume per application is the whole
    premise of the tracker, so charging to copy one would gate the workflow
    rather than the deliverable.
  */
  async duplicateResume(resumeId: string, userId: string, title?: string) {
    const source = await this.getResumeById(resumeId, userId);

    return this.resumeRepo.create({
      userId,
      title: title?.trim() || nextCopyTitle(source.title),
      templateId: source.templateId,
      /*
        Each section is spread only when it is non-null. Prisma rejects a plain
        `null` for a nullable Json column — it wants Prisma.DbNull — so copying
        a resume with empty sections would throw at the first unset one.
      */
      ...(source.personalInfo !== null && { personalInfo: source.personalInfo }),
      ...(source.experience !== null && { experience: source.experience }),
      ...(source.education !== null && { education: source.education }),
      ...(source.skills !== null && { skills: source.skills }),
      ...(source.languages !== null && { languages: source.languages }),
      ...(source.certifications !== null && { certifications: source.certifications }),
      ...(source.projects !== null && { projects: source.projects }),
      ...(source.references !== null && { references: source.references }),
    });
  }

  async updateResume(
    resumeId: string,
    userId: string,
    data: {
      title?: string;
      templateId?: string;
      personalInfo?: any;
      experience?: any;
      education?: any;
      skills?: any;
      languages?: any;
      certifications?: any;
      projects?: any;
      references?: any;
      isPublished?: boolean;
    },
  ) {
    // Verify resume exists
    await this.getResumeById(resumeId, userId);

    // Validate template if provided
    if (data.templateId) {
      await this.templateService.getTemplateById(data.templateId);
    }

    return this.resumeRepo.update(resumeId, userId, data);
  }

  async deleteResume(resumeId: string, userId: string) {
    await this.getResumeById(resumeId, userId);
    return this.resumeRepo.delete(resumeId, userId);
  }

  /*
    Records an export. The PDF itself is produced on-device — the client builds
    the resume HTML and hands it to expo-print, which uses the OS renderer to
    emit real selectable text. Server-side rendering would mean shipping
    Chromium alongside the API for something the phone already does well.

    This endpoint exists so lastExportedAt is tracked and, once subscriptions
    land, so export can be gated somewhere the client cannot bypass.
  */
  async exportResume(resumeId: string, userId: string) {
    await assertPro(userId, PRO_FEATURES.RESUME_EXPORT);

    const resume = await this.getResumeById(resumeId, userId);

    await this.resumeRepo.updateLastExported(resumeId, userId);

    return {
      resumeId,
      title: resume.title,
      exportedAt: new Date().toISOString(),
    };
  }
}
