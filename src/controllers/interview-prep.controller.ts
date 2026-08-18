import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import {
  createQuestionSchema,
  getQuestionsQuerySchema,
  recordPracticeSchema,
  saveAnswerSchema,
  updateQuestionSchema,
  uploadAnswerAudioSchema,
} from "../schemas/interview-prep";
import { InterviewPrepService } from "../services/interview-prep.service";

export class InterviewPrepController {
  private prepService = new InterviewPrepService();

  async getQuestions(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const query = getQuestionsQuerySchema.parse(req.query);

      const questions = await this.prepService.getQuestions(userId!, {
        ...(query.category && { category: query.category }),
        ...(query.status && { status: query.status }),
        ...(query.search && { search: query.search }),
        ...(query.applicationId && { applicationId: query.applicationId }),
        ...(query.unanswered !== undefined && { unanswered: query.unanswered }),
      });

      res.status(200).json({
        message: "Questions fetched successfully!",
        data: questions,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getStats(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const stats = await this.prepService.getStats(userId!);

      res.status(200).json({
        message: "Interview prep stats fetched successfully!",
        data: stats,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getQuestionById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const question = await this.prepService.getQuestionById(id as string, userId!);

      res.status(200).json({
        message: "Question retrieved successfully",
        data: question,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createQuestion(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const data = createQuestionSchema.parse(req.body);

      const question = await this.prepService.createQuestion(userId!, data);

      res.status(201).json({
        message: "Question added successfully",
        data: question,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateQuestion(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const body = updateQuestionSchema.parse(req.body);

      const question = await this.prepService.updateQuestion(id as string, userId!, {
        ...(body.text && { text: body.text }),
        ...(body.category && { category: body.category }),
        ...(body.guidance !== undefined && { guidance: body.guidance }),
      });

      res.status(200).json({
        message: "Question updated successfully",
        data: question,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteQuestion(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.prepService.deleteQuestion(id as string, userId!);

      res.status(204).json({ message: "Question deleted successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async saveAnswer(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const body = saveAnswerSchema.parse(req.body);

      const answer = await this.prepService.saveAnswer(userId!, id as string, {
        ...(body.text !== undefined && { text: body.text }),
        ...(body.status !== undefined && { status: body.status }),
      });

      res.status(200).json({
        message: "Answer saved successfully",
        data: answer,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async uploadAnswerAudio(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { duration } = uploadAnswerAudioSchema.parse(req.body);

      const answer = await this.prepService.saveAnswerAudio(
        userId!,
        id as string,
        duration,
        req.file,
      );

      res.status(200).json({
        message: "Answer recording saved successfully",
        data: answer,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteAnswerAudio(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const answer = await this.prepService.deleteAnswerAudio(userId!, id as string);

      res.status(200).json({
        message: "Answer recording removed",
        data: answer,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async recordPractice(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { questionIds } = recordPracticeSchema.parse(req.body);

      const result = await this.prepService.recordPractice(userId!, questionIds);

      res.status(200).json({
        message: "Practice session recorded",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async linkToApplication(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { applicationId, id } = req.params;

      const link = await this.prepService.linkToApplication(
        applicationId as string,
        id as string,
        userId!,
      );

      res.status(201).json({
        message: "Question pinned to application",
        data: link,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async unlinkFromApplication(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { applicationId, id } = req.params;

      await this.prepService.unlinkFromApplication(
        applicationId as string,
        id as string,
        userId!,
      );

      res.status(204).json({ message: "Question unpinned from application" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
