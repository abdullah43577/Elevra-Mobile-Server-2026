import type { ApplicationStatus, Prisma, WorkArrangement } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const listInclude = {
  resume: { select: { id: true, title: true } },
  _count: { select: { linkedNotes: true, linkedRecordings: true } },
} satisfies Prisma.JobApplicationInclude;

const detailInclude = {
  resume: { select: { id: true, title: true, templateId: true, updatedAt: true } },
  linkedNotes: {
    include: {
      note: { select: { id: true, title: true, updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  linkedRecordings: {
    include: {
      recording: { select: { id: true, title: true, duration: true, fileUrl: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.JobApplicationInclude;

export interface JobApplicationWriteData {
  company?: string;
  role?: string;
  location?: string | null;
  workArrangement?: WorkArrangement | null;
  jobUrl?: string | null;
  source?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  status?: ApplicationStatus;
  appliedAt?: Date | null;
  notes?: string | null;
  resumeId?: string | null;
  isArchived?: boolean;
  statusChangedAt?: Date;
}

export class JobApplicationRepository {
  async findManyByUser(
    userId: string,
    options?: {
      status?: ApplicationStatus;
      search?: string;
      isArchived?: boolean;
    },
  ) {
    const { status, search, isArchived = false } = options || {};

    return prisma.jobApplication.findMany({
      where: {
        userId,
        isArchived,
        ...(status && { status }),
        ...(search && {
          OR: [
            { company: { contains: search, mode: "insensitive" } },
            { role: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: listInclude,
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async findById(id: string, userId: string) {
    return prisma.jobApplication.findFirst({
      where: { id, userId },
      include: detailInclude,
    });
  }

  async countByStatus(userId: string) {
    return prisma.jobApplication.groupBy({
      by: ["status"],
      where: { userId, isArchived: false },
      _count: { _all: true },
    });
  }

  async create(data: JobApplicationWriteData & { userId: string; company: string; role: string }) {
    return prisma.jobApplication.create({
      data,
      include: detailInclude,
    });
  }

  async update(id: string, userId: string, data: JobApplicationWriteData) {
    return prisma.jobApplication.update({
      where: { id, userId },
      data,
      include: detailInclude,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.jobApplication.delete({
      where: { id, userId },
    });
  }

  async linkNote(applicationId: string, noteId: string) {
    return prisma.applicationNote.create({
      data: { applicationId, noteId },
      include: { note: { select: { id: true, title: true, updatedAt: true } } },
    });
  }

  async unlinkNote(applicationId: string, noteId: string) {
    return prisma.applicationNote.deleteMany({
      where: { applicationId, noteId },
    });
  }

  async linkRecording(applicationId: string, recordingId: string) {
    return prisma.applicationRecording.create({
      data: { applicationId, recordingId },
      include: {
        recording: { select: { id: true, title: true, duration: true, fileUrl: true, createdAt: true } },
      },
    });
  }

  async unlinkRecording(applicationId: string, recordingId: string) {
    return prisma.applicationRecording.deleteMany({
      where: { applicationId, recordingId },
    });
  }

  /*
    The reminder sweep is a system job, so this is the one method in this
    repository that is NOT scoped to a single user. Everything else here takes
    a userId and must keep doing so. Callers pass a userId only when running the
    sweep on demand for one account (testing, or a manual "check now").
  */
  async findDueForReminder(rules: { status: ApplicationStatus; idleSince: Date }[], cooldownBefore: Date, userId?: string) {
    return prisma.jobApplication.findMany({
      where: {
        isArchived: false,
        ...(userId && { userId }),
        AND: [
          {
            OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cooldownBefore } }],
          },
          {
            OR: rules.map(rule =>
              rule.status === "SAVED"
                ? { status: rule.status, createdAt: { lt: rule.idleSince } }
                : rule.status === "APPLIED"
                  ? { status: rule.status, appliedAt: { lt: rule.idleSince } }
                  : { status: rule.status, statusChangedAt: { lt: rule.idleSince } },
            ),
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        company: true,
        role: true,
        status: true,
        appliedAt: true,
        createdAt: true,
        statusChangedAt: true,
      },
    });
  }

  async markReminded(ids: string[], at: Date) {
    return prisma.jobApplication.updateMany({
      where: { id: { in: ids } },
      data: { lastReminderAt: at },
    });
  }

  async findOwnedNote(noteId: string, userId: string) {
    return prisma.note.findFirst({ where: { id: noteId, userId }, select: { id: true } });
  }

  async findOwnedRecording(recordingId: string, userId: string) {
    return prisma.voiceRecording.findFirst({ where: { id: recordingId, userId }, select: { id: true } });
  }

  async findOwnedResume(resumeId: string, userId: string) {
    return prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } });
  }
}
