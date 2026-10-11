import { BadRequestError, NotFoundError } from "../lib/errors";
import {
  CoverLetterRepository,
  type CoverLetterWriteData,
} from "../repositories/cover-letter.repository";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import type { CreateCoverLetterInput } from "../schemas/cover-letter";
import { TemplateService } from "./resume/template.service";

export class CoverLetterService {
  private coverLetterRepo = new CoverLetterRepository();
  private applicationRepo = new JobApplicationRepository();
  private templateService = new TemplateService();

  async getCoverLetters(userId: string, filters: { search?: string } = {}) {
    return this.coverLetterRepo.findManyByUser(userId, filters);
  }

  async getCoverLetterById(coverLetterId: string, userId: string) {
    const coverLetter = await this.coverLetterRepo.findById(coverLetterId, userId);
    if (!coverLetter) {
      throw new NotFoundError("Cover letter not found");
    }
    return coverLetter;
  }

  async createCoverLetter(userId: string, data: CreateCoverLetterInput) {
    await this.templateService.getTemplateById(data.templateId);

    if (!data.body.trim()) {
      throw new BadRequestError("Cover letter body is required");
    }

    // Checked before creating, so a bad id cannot leave an orphan letter behind.
    if (data.applicationId && !(await this.applicationRepo.findById(data.applicationId, userId))) {
      throw new NotFoundError("Application not found");
    }

    const coverLetter = await this.coverLetterRepo.create({
      userId,
      templateId: data.templateId,
      title: data.title?.trim() || `${data.company} — ${data.role}`,
      company: data.company.trim(),
      role: data.role.trim(),
      body: data.body,
      ...(data.personalInfo !== undefined && { personalInfo: data.personalInfo }),
      ...(data.recipientName !== undefined && { recipientName: data.recipientName }),
      ...(data.recipientTitle !== undefined && { recipientTitle: data.recipientTitle }),
      ...(data.companyAddress !== undefined && { companyAddress: data.companyAddress }),
      ...(data.closing !== undefined && { closing: data.closing }),
    });

    if (data.applicationId) {
      await this.applicationRepo.update(data.applicationId, userId, { coverLetterId: coverLetter.id });
    }

    return coverLetter;
  }

  async updateCoverLetter(
    coverLetterId: string,
    userId: string,
    data: CoverLetterWriteData,
  ) {
    await this.getCoverLetterById(coverLetterId, userId);

    if (data.templateId) {
      await this.templateService.getTemplateById(data.templateId);
    }

    if (data.body !== undefined && !data.body.trim()) {
      throw new BadRequestError("Cover letter body is required");
    }

    return this.coverLetterRepo.update(coverLetterId, userId, data);
  }

  async deleteCoverLetter(coverLetterId: string, userId: string) {
    await this.getCoverLetterById(coverLetterId, userId);
    return this.coverLetterRepo.delete(coverLetterId, userId);
  }

  async exportCoverLetter(coverLetterId: string, userId: string) {

    const coverLetter = await this.getCoverLetterById(coverLetterId, userId);

    await this.coverLetterRepo.updateLastExported(coverLetterId, userId);

    return {
      coverLetterId,
      title: coverLetter.title,
      exportedAt: new Date().toISOString(),
    };
  }
}
