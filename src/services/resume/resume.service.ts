import { ResumeRepository } from "../../repositories/resume/resume.repository";
import { TemplateService } from "./template.service";
import { BadRequestError, NotFoundError } from "../../lib/errors";

const TITLE_MAX = 100;

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

  async duplicateResume(resumeId: string, userId: string, title?: string) {
    const source = await this.getResumeById(resumeId, userId);

    return this.resumeRepo.create({
      userId,
      title: title?.trim() || nextCopyTitle(source.title),
      templateId: source.templateId,
      // Spread only when non-null: Prisma rejects a plain null for a nullable Json column (wants DbNull).
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
    await this.getResumeById(resumeId, userId);

    if (data.templateId) {
      await this.templateService.getTemplateById(data.templateId);
    }

    return this.resumeRepo.update(resumeId, userId, data);
  }

  async deleteResume(resumeId: string, userId: string) {
    await this.getResumeById(resumeId, userId);
    return this.resumeRepo.delete(resumeId, userId);
  }

  async exportResume(resumeId: string, userId: string) {
    const resume = await this.getResumeById(resumeId, userId);

    await this.resumeRepo.updateLastExported(resumeId, userId);

    return {
      resumeId,
      title: resume.title,
      exportedAt: new Date().toISOString(),
    };
  }
}
