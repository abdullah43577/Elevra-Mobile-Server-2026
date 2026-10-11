import { prisma } from "../lib/prisma";

const matches = (term: string) => ({ contains: term, mode: "insensitive" as const });

// Archived notes and applications are included on purpose: their lists hide them.
export class SearchRepository {
  async searchNotes(userId: string, term: string, limit: number) {
    return prisma.note.findMany({
      where: {
        userId,
        OR: [{ title: matches(term) }, { content: matches(term) }],
      },
      select: {
        id: true,
        title: true,
        content: true,
        isArchived: true,
        updatedAt: true,
        folder: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  async searchRecordings(userId: string, term: string, limit: number) {
    return prisma.voiceRecording.findMany({
      where: {
        userId,
        OR: [{ title: matches(term) }, { transcription: matches(term) }],
      },
      select: {
        id: true,
        title: true,
        transcription: true,
        duration: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  // Title only: casting the Json sections to text would match their keys ("company", "title")
  // and return every resume.
  async searchResumes(userId: string, term: string, limit: number) {
    return prisma.resume.findMany({
      where: { userId, title: matches(term) },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        template: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  async searchApplications(userId: string, term: string, limit: number) {
    return prisma.jobApplication.findMany({
      where: {
        userId,
        OR: [
          { company: matches(term) },
          { role: matches(term) },
          { location: matches(term) },
          { source: matches(term) },
          { notes: matches(term) },
        ],
      },
      select: {
        id: true,
        company: true,
        role: true,
        location: true,
        status: true,
        notes: true,
        isArchived: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  async searchCoverLetters(userId: string, term: string, limit: number) {
    return prisma.coverLetter.findMany({
      where: {
        userId,
        OR: [
          { title: matches(term) },
          { company: matches(term) },
          { role: matches(term) },
          { body: matches(term) },
        ],
      },
      select: {
        id: true,
        title: true,
        company: true,
        role: true,
        body: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  // Only questions the user wrote or answered, never the whole seeded catalogue.
  async searchInterviewQuestions(userId: string, term: string, limit: number) {
    return prisma.interviewQuestion.findMany({
      where: {
        OR: [{ userId }, { answers: { some: { userId } } }],
        AND: [
          {
            OR: [{ text: matches(term) }, { answers: { some: { userId, text: matches(term) } } }],
          },
        ],
      },
      select: {
        id: true,
        text: true,
        category: true,
        updatedAt: true,
        answers: {
          where: { userId },
          select: { text: true, status: true, updatedAt: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }
}
