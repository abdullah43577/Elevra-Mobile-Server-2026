import type { AnswerStatus, InterviewCategory } from "../generated/prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors";
import {
  InterviewPrepRepository,
  type AnswerWriteData,
  type QuestionFilters,
} from "../repositories/interview-prep.repository";
import type { CreateQuestionInput } from "../schemas/interview-prep";
import { CloudinaryService } from "./cloudinary.service";

const PRACTICE_WINDOW_DAYS = 7;

export class InterviewPrepService {
  private prepRepo = new InterviewPrepRepository();
  private cloudinaryService = new CloudinaryService();

  async getQuestions(userId: string, filters: QuestionFilters = {}) {
    if (filters.applicationId) {
      await this.assertApplicationOwned(filters.applicationId, userId);
    }

    return this.prepRepo.findQuestions(userId, filters);
  }

  async getQuestionById(questionId: string, userId: string) {
    const question = await this.prepRepo.findQuestionById(questionId, userId);
    if (!question) throw new NotFoundError("Question not found");
    return question;
  }

  async createQuestion(userId: string, data: CreateQuestionInput) {
    return this.prepRepo.createQuestion({
      userId,
      text: data.text.trim(),
      category: data.category,
      ...(data.guidance && { guidance: data.guidance.trim() }),
    });
  }

  async updateQuestion(
    questionId: string,
    userId: string,
    data: { text?: string; category?: InterviewCategory; guidance?: string | null },
  ) {
    await this.assertQuestionOwned(questionId, userId);
    return this.prepRepo.updateQuestion(questionId, userId, data);
  }

  async deleteQuestion(questionId: string, userId: string) {
    await this.assertQuestionOwned(questionId, userId);
    return this.prepRepo.deleteQuestion(questionId, userId);
  }

  async saveAnswer(
    userId: string,
    questionId: string,
    data: { text?: string | null; status?: AnswerStatus },
  ) {
    // Confirms the question exists and is visible to this user before an answer
    // row is created against it.
    await this.getQuestionById(questionId, userId);

    const writeData: AnswerWriteData = {
      ...(data.text !== undefined && { text: data.text }),
      ...(data.status !== undefined && { status: data.status }),
    };

    return this.prepRepo.upsertAnswer(userId, questionId, writeData);
  }

  async saveAnswerAudio(
    userId: string,
    questionId: string,
    duration: number,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestError("No audio file provided");

    await this.getQuestionById(questionId, userId);

    const upload = await this.cloudinaryService.uploadFile("interview-answers", file, "auto");

    return this.prepRepo.upsertAnswer(userId, questionId, {
      audioUrl: upload.secure_url,
      audioDuration: duration,
    });
  }

  async deleteAnswerAudio(userId: string, questionId: string) {
    const answer = await this.prepRepo.findAnswer(userId, questionId);
    if (!answer) throw new NotFoundError("Answer not found");

    return this.prepRepo.upsertAnswer(userId, questionId, {
      audioUrl: null,
      audioDuration: null,
    });
  }

  /*
    Reported once at the end of a run. Answers are created first for any question
    rehearsed but never written down — otherwise the questions someone practises
    out loud and never types would never register as practised at all, which is
    precisely the group the ordering is meant to surface.
  */
  async recordPractice(userId: string, questionIds: string[]) {
    const visible = await this.prepRepo.findQuestions(userId, {});
    const visibleIds = new Set(visible.map(question => question.id));

    const allowed = questionIds.filter(id => visibleIds.has(id));
    if (allowed.length === 0) throw new BadRequestError("No valid questions in this session");

    await this.prepRepo.ensureAnswersExist(userId, allowed);
    await this.prepRepo.recordPractice(userId, allowed, new Date());

    return { practised: allowed.length };
  }

  async getStats(userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - PRACTICE_WINDOW_DAYS);

    const [grouped, totalQuestions, practisedThisWeek] = await Promise.all([
      this.prepRepo.countsByStatus(userId),
      this.prepRepo.countQuestions(userId),
      this.prepRepo.countPractised(userId, since),
    ]);

    const byStatus = { DRAFT: 0, NEEDS_WORK: 0, READY: 0 };
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
    }

    const answered = byStatus.DRAFT + byStatus.NEEDS_WORK + byStatus.READY;

    return {
      byStatus,
      totalQuestions,
      answered,
      notStarted: Math.max(totalQuestions - answered, 0),
      practisedThisWeek,
    };
  }

  async linkToApplication(applicationId: string, questionId: string, userId: string) {
    await this.assertApplicationOwned(applicationId, userId);
    await this.getQuestionById(questionId, userId);

    return this.prepRepo.linkToApplication(applicationId, questionId);
  }

  async unlinkFromApplication(applicationId: string, questionId: string, userId: string) {
    await this.assertApplicationOwned(applicationId, userId);
    return this.prepRepo.unlinkFromApplication(applicationId, questionId);
  }

  /*
    Seeded questions are visible to everyone and owned by nobody, so "can read"
    and "can edit" are different checks here. Without this a user could edit the
    shared catalogue for every other user.
  */
  private async assertQuestionOwned(questionId: string, userId: string) {
    const owned = await this.prepRepo.findOwnedQuestion(questionId, userId);
    if (!owned) {
      const exists = await this.prepRepo.findQuestionById(questionId, userId);
      if (exists) throw new ForbiddenError("You can only edit questions you added");
      throw new NotFoundError("Question not found");
    }
  }

  private async assertApplicationOwned(applicationId: string, userId: string) {
    const application = await this.prepRepo.findOwnedApplication(applicationId, userId);
    if (!application) throw new NotFoundError("Application not found");
  }
}
