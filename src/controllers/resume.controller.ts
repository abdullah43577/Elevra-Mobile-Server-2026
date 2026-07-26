import { type Response } from "express";
import { ResumeService } from "../services/resume/resume.service";
import { TemplateService } from "../services/resume/template.service";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { createResumeSchema, getTemplatesQuerySchema, updateResumeSchema } from "../schemas/resume";
import { CloudinaryService } from "../services/cloudinary.service";
import { BadRequestError } from "../lib/errors";

export class ResumeController {
  private resumeService = new ResumeService();
  private templateService = new TemplateService();
  private cloudinaryService = new CloudinaryService();

  // ==================== Templates ====================

  async getTemplates(req: IUserRequest, res: Response) {
    try {
      const { category, isPremium, search } = getTemplatesQuerySchema.parse(req.query);

      const templates = await this.templateService.getTemplates({
        ...(category && { category }),
        ...(isPremium && { isPremium }),
        ...(search && { search }),
      });

      res.status(200).json({
        message: "Templates fetched successfully!",
        data: templates,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getTemplateById(req: IUserRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = await this.templateService.getTemplateById(id as string);

      res.status(200).json({
        message: "Template retrieved successfully",
        data: template,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async uploadThumbnail(req: IUserRequest, res: Response) {
    try {
      const { templateId } = req.body;
      const file = req.file;

      if (!file) throw new BadRequestError("No image file provided");

      // Only admin can upload thumbnails (or use a secret key)
      // For now, we'll trust the user (you can add admin check later)

      // Upload to Cloudinary
      const result = await this.cloudinaryService.uploadFile(
        "templates", // folder
        file,
        "auto",
      );

      // Update template with thumbnail URL
      const template = await this.templateService.updateThumbnail(templateId as string, result.secure_url);

      res.status(200).json({
        message: "Thumbnail uploaded successfully",
        data: template,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  // ==================== Resumes ====================

  async getResumes(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const resumes = await this.resumeService.getResumes(userId!);

      res.status(200).json({
        message: "Resumes fetched successfully!",
        data: resumes,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getResumeById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const resume = await this.resumeService.getResumeById(id as string, userId!);

      res.status(200).json({
        message: "Resume retrieved successfully",
        data: resume,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createResume(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { title, templateId, personalInfo, experience, education, skills } = createResumeSchema.parse(req.body);

      const resume = await this.resumeService.createResume(userId!, {
        title,
        templateId,
        personalInfo,
        experience,
        education,
        skills,
      });

      res.status(201).json({
        message: "Resume created successfully",
        data: resume,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateResume(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { title, templateId, personalInfo, experience, education, skills } = updateResumeSchema.parse(req.body);

      const resume = await this.resumeService.updateResume(id as string, userId!, {
        ...(title && { title }),
        ...(templateId && { templateId }),
        personalInfo,
        experience,
        education,
        skills,
      });

      res.status(200).json({
        message: "Resume updated successfully",
        data: resume,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteResume(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.resumeService.deleteResume(id as string, userId!);

      res.status(204).json({
        message: "Resume deleted successfully!",
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async exportResume(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const result = await this.resumeService.exportResume(id as string, userId!);

      res.status(200).json({
        message: "Resume export started",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
