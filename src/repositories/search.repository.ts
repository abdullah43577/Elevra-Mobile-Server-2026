import { prisma } from "../lib/prisma";

const matches = (term: string) => ({ contains: term, mode: "insensitive" as const });

/*
  Every method selects the narrowest set of columns the result row can be built
  from. Search runs six queries at once on every debounced keystroke, so pulling
  full rows — a resume's eight Json sections, a letter's whole body — would move
  megabytes to render a one-line result.

  Archived notes and archived applications are deliberately included. Their list
  screens exclude them, which makes search the only way to reach one without
  first knowing where it was filed; the service marks them so the result does
  not look like a live row.
*/
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

  /*
    Title only. The sections a resume is actually made of live in Json columns,
    and reaching them means casting to text in raw SQL — which then matches the
    *keys* as well as the values, so searching "company", "title", "location" or
    "description" would return every resume the user owns. A false positive on
    every generic term is worse than not searching the body at all.
  */
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

  /*
    Scoped to questions the user wrote or has answered, never the whole seeded
    catalogue. Global search finds *your* material; a seeded question you have
    never opened is not yours yet, and matching all 50 on a common word like
    "team" would bury the notes and applications the user was looking for. The
    interview-prep screen has its own search for browsing the bank.
  */
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
