import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { createCoverLetterSchema, draftCoverLetterSchema, updateCoverLetterSchema } from "../schemas/cover-letter";
import { CoverLetterDraftService } from "../services/cover-letter-draft.service";
import { CoverLetterService } from "../services/cover-letter.service";
import { z } from "zod";

const listQuerySchema = z.object({ search: z.string().optional() });

export class CoverLetterController {
  private coverLetterService = new CoverLetterService();
  private draftService = new CoverLetterDraftService();

  async draftCoverLetter(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const input = draftCoverLetterSchema.parse(req.body);

      const draft = await this.draftService.draft(userId!, input);
      res.status(200).json({ message: "Cover letter drafted", data: draft });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getCoverLetters(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { search } = listQuerySchema.parse(req.query);

      const coverLetters = await this.coverLetterService.getCoverLetters(userId!, {
        ...(search && { search }),
      });

      res.status(200).json({
        message: "Cover letters fetched successfully!",
        data: coverLetters,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getCoverLetterById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const coverLetter = await this.coverLetterService.getCoverLetterById(id as string, userId!);

      res.status(200).json({
        message: "Cover letter retrieved successfully",
        data: coverLetter,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createCoverLetter(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const data = createCoverLetterSchema.parse(req.body);

      const coverLetter = await this.coverLetterService.createCoverLetter(userId!, data);

      res.status(201).json({
        message: "Cover letter created successfully",
        data: coverLetter,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateCoverLetter(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const body = updateCoverLetterSchema.parse(req.body);

      // Conditional spreads: exactOptionalPropertyTypes rejects the undefined a blanket spread carries.
      const coverLetter = await this.coverLetterService.updateCoverLetter(id as string, userId!, {
        ...(body.title && { title: body.title }),
        ...(body.templateId && { templateId: body.templateId }),
        ...(body.personalInfo !== undefined && { personalInfo: body.personalInfo }),
        ...(body.company && { company: body.company }),
        ...(body.role && { role: body.role }),
        ...(body.recipientName !== undefined && { recipientName: body.recipientName }),
        ...(body.recipientTitle !== undefined && { recipientTitle: body.recipientTitle }),
        ...(body.companyAddress !== undefined && { companyAddress: body.companyAddress }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.closing !== undefined && { closing: body.closing }),
      });

      res.status(200).json({
        message: "Cover letter updated successfully",
        data: coverLetter,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteCoverLetter(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.coverLetterService.deleteCoverLetter(id as string, userId!);

      res.status(204).json({
        message: "Cover letter deleted successfully!",
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async exportCoverLetter(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const result = await this.coverLetterService.exportCoverLetter(id as string, userId!);

      res.status(200).json({
        message: "Cover letter export recorded",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
