import { type Request, type Response, type NextFunction } from "express";
import { ProfessionService } from "../services/profession.service";

const professionService = new ProfessionService();

export class ProfessionController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const professions = await professionService.listProfessions();
      res.status(200).json({
        message: "Professions fetched successfully",
        data: professions,
      });
    } catch (error) {
      next(error);
    }
  }
}
