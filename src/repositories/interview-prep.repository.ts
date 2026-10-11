import type { AnswerStatus, InterviewCategory, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

// Questions are read as "seeded OR mine": the catalogue is global (userId null).
const visibleTo = function (userId: string): Prisma.InterviewQuestionWhereInput {
  return { isActive: true, OR: [{ userId: null }, { userId }] };
};

const answerFor = function (userId: string) {
  return { answers: { where: { userId }, take: 1 } };
};

export interface QuestionFilters {
  category?: InterviewCategory;
  search?: string;
  status?: AnswerStatus;
  unanswered?: boolean;
  applicationId?: string;
}

export interface AnswerWriteData {
  text?: string | null;
  status?: AnswerStatus;
  audioUrl?: string | null;
  audioDuration?: number | null;
  transcript?: string | null;
  feedback?: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

export class InterviewPrepRepository {
  async findQuestions(userId: string, filters: QuestionFilters = {}) {
    const where: Prisma.InterviewQuestionWhereInput = {
      ...visibleTo(userId),
      ...(filters.category && { category: filters.category }),
      ...(filters.search && {
        text: { contains: filters.search, mode: "insensitive" },
      }),
      ...(filters.applicationId && {
        applications: { some: { applicationId: filters.applicationId } },
      }),
      ...(filters.status && {
        answers: { some: { userId, status: filters.status } },
      }),
      ...(filters.unanswered && { answers: { none: { userId } } }),
    };

    return prisma.interviewQuestion.findMany({
      where,
      include: answerFor(userId),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async findQuestionById(questionId: string, userId: string) {
    return prisma.interviewQuestion.findFirst({
      where: { id: questionId, ...visibleTo(userId) },
      include: answerFor(userId),
    });
  }

  async createQuestion(data: {
    userId: string;
    text: string;
    category: InterviewCategory;
    guidance?: string;
  }) {
    return prisma.interviewQuestion.create({
      data,
      include: answerFor(data.userId),
    });
  }

  async updateQuestion(
    questionId: string,
    userId: string,
    data: { text?: string; category?: InterviewCategory; guidance?: string | null },
  ) {
    return prisma.interviewQuestion.update({
      where: { id: questionId, userId },
      data,
      include: answerFor(userId),
    });
  }

  async deleteQuestion(questionId: string, userId: string) {
    return prisma.interviewQuestion.delete({
      where: { id: questionId, userId },
    });
  }

  async findOwnedQuestion(questionId: string, userId: string) {
    return prisma.interviewQuestion.findFirst({
      where: { id: questionId, userId },
      select: { id: true },
    });
  }

  async upsertAnswer(userId: string, questionId: string, data: AnswerWriteData) {
    return prisma.interviewAnswer.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, ...data },
      update: data,
      include: { question: true },
    });
  }

  // Saves only if the take is still current; returns false when a new take replaced it.
  async saveCoachingForTake(userId: string, questionId: string, audioUrl: string, data: { transcript: string; feedback: Prisma.InputJsonValue }) {
    const { count } = await prisma.interviewAnswer.updateMany({
      where: { userId, questionId, audioUrl },
      data,
    });
    return count > 0;
  }

  async findAnswer(userId: string, questionId: string) {
    return prisma.interviewAnswer.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
  }

  async recordPractice(userId: string, questionIds: string[], practisedAt: Date) {
    return prisma.interviewAnswer.updateMany({
      where: { userId, questionId: { in: questionIds } },
      data: { practiceCount: { increment: 1 }, lastPracticedAt: practisedAt },
    });
  }

  async ensureAnswersExist(userId: string, questionIds: string[]) {
    return prisma.interviewAnswer.createMany({
      data: questionIds.map((questionId) => ({ userId, questionId })),
      skipDuplicates: true,
    });
  }

  async countsByStatus(userId: string) {
    return prisma.interviewAnswer.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });
  }

  async countQuestions(userId: string) {
    return prisma.interviewQuestion.count({ where: visibleTo(userId) });
  }

  async countPractised(userId: string, since: Date) {
    return prisma.interviewAnswer.count({
      where: { userId, lastPracticedAt: { gte: since } },
    });
  }

  async linkToApplication(applicationId: string, questionId: string) {
    return prisma.applicationQuestion.upsert({
      where: { applicationId_questionId: { applicationId, questionId } },
      create: { applicationId, questionId },
      update: {},
    });
  }

  async createAndPinQuestions(
    userId: string,
    applicationId: string,
    questions: { text: string; category: InterviewCategory; guidance?: string }[],
    existingIdsToPin: string[],
  ) {
    return prisma.$transaction(async tx => {
      const created = [];
      for (const question of questions) {
        created.push(await tx.interviewQuestion.create({ data: { userId, ...question }, include: answerFor(userId) }));
      }

      await tx.applicationQuestion.createMany({
        data: [...created.map(question => question.id), ...existingIdsToPin].map(questionId => ({ applicationId, questionId })),
        skipDuplicates: true,
      });

      return created;
    });
  }

  async unlinkFromApplication(applicationId: string, questionId: string) {
    return prisma.applicationQuestion.deleteMany({
      where: { applicationId, questionId },
    });
  }

  async findOwnedApplication(applicationId: string, userId: string) {
    return prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
  }
}
