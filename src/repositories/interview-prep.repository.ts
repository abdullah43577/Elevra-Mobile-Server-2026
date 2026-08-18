import type { AnswerStatus, InterviewCategory, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

/*
  The catalogue is global (userId null) plus whatever the user wrote themselves,
  so every read is scoped as "seeded OR mine" rather than "mine". That is the one
  place this domain deviates from the every-query-is-scoped-by-userId rule, and
  it is why questions are read-only unless you own them — the service enforces
  that separately.
*/
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

  /** Only a question the user authored can be edited or deleted. */
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

  async findAnswer(userId: string, questionId: string) {
    return prisma.interviewAnswer.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
  }

  /*
    One statement for a whole practice run. The runner would otherwise fire a
    request per question, which on a bad connection means a session that half
    records itself.
  */
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
