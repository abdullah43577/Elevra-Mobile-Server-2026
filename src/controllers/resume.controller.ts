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
      const { id } = req.params;
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
      const template = await this.templateService.updateThumbnail(id as string, result.secure_url);

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
      const data = createResumeSchema.parse(req.body);

      const resume = await this.resumeService.createResume(userId!, data);

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
      const body = updateResumeSchema.parse(req.body);

      /*
        Spread each section conditionally rather than passing the parsed body
        through. exactOptionalPropertyTypes rejects an explicit `undefined`, and
        a blanket spread carries one for every key the client left out.
      */
      const resume = await this.resumeService.updateResume(id as string, userId!, {
        ...(body.title && { title: body.title }),
        ...(body.templateId && { templateId: body.templateId }),
        ...(body.personalInfo !== undefined && { personalInfo: body.personalInfo }),
        ...(body.experience !== undefined && { experience: body.experience }),
        ...(body.education !== undefined && { education: body.education }),
        ...(body.skills !== undefined && { skills: body.skills }),
        ...(body.languages !== undefined && { languages: body.languages }),
        ...(body.certifications !== undefined && { certifications: body.certifications }),
        ...(body.projects !== undefined && { projects: body.projects }),
        ...(body.references !== undefined && { references: body.references }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
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
        message: "Resume export recorded",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
