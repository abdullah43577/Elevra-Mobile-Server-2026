import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { saveCareerProfileSchema } from "../schemas/career-profile";
import { BadRequestError } from "../lib/errors";
import { CareerProfileService } from "../services/career-profile.service";
import { ResumeImportService } from "../services/resume-import.service";

export class CareerProfileController {
  private careerProfileService = new CareerProfileService();
  private importService = new ResumeImportService();

  async importProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      if (!req.file) throw new BadRequestError("Choose a PDF file.");

      const data = await this.importService.importFromPdf(userId!, req.file.buffer);
      res.status(200).json({ message: "Resume read successfully", data });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const profile = await this.careerProfileService.getProfile(userId!);

      res.status(200).json({
        message: "Career profile fetched successfully!",
        data: profile,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async saveProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const data = saveCareerProfileSchema.parse(req.body);

      const profile = await this.careerProfileService.saveProfile(userId!, data);

      res.status(200).json({
        message: "Career profile saved successfully",
        data: profile,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      await this.careerProfileService.deleteProfile(userId!);

      res.status(204).json({
        message: "Career profile deleted successfully!",
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
