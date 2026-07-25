import { TemplateRepository } from "../../repositories/resume/template.repository";
import { NotFoundError } from "../../lib/errors";

export class TemplateService {
  private templateRepo = new TemplateRepository();

  async getTemplates(options?: { category?: string; isPremium?: boolean; search?: string }) {
    return this.templateRepo.findMany(options);
  }

  async getTemplateById(templateId: string) {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new NotFoundError("Template not found");
    }
    return template;
  }
}
