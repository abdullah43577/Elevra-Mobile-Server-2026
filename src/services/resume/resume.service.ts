import { ResumeRepository } from "../../repositories/resume/resume.repository";
import { TemplateService } from "./template.service";
import { BadRequestError, NotFoundError } from "../../lib/errors";

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
    const resume = await this.getResumeById(resumeId, userId);

    await this.resumeRepo.updateLastExported(resumeId, userId);

    return {
      resumeId,
      title: resume.title,
      exportedAt: new Date().toISOString(),
    };
  }
}
