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

  async exportResume(resumeId: string, userId: string) {
    const resume = await this.getResumeById(resumeId, userId);

    // Update last exported timestamp
    await this.resumeRepo.updateLastExported(resumeId, userId);

    // TODO: Generate PDF
    // This will be implemented when we add PDF generation

    return {
      resumeId,
      exportedAt: new Date().toISOString(),
      message: "Export functionality coming soon",
    };
  }
}
