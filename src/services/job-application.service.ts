import type { ApplicationStatus } from "../generated/prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../lib/errors";
import { JobApplicationRepository, type JobApplicationWriteData } from "../repositories/job-application.repository";
import type { CreateJobApplicationInput } from "../schemas/job-application";

const ALL_STATUSES: ApplicationStatus[] = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"];

// Anything past SAVED means the application actually went out, so appliedAt
// should be stamped even when the client did not send one.
const SUBMITTED_STATUSES: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"];

export class JobApplicationService {
  private applicationRepo = new JobApplicationRepository();

  async getApplications(
    userId: string,
    options?: {
      status?: ApplicationStatus;
      search?: string;
      isArchived?: boolean;
    },
  ) {
    try {
      return await this.applicationRepo.findManyByUser(userId, options);
    } catch (error) {
      throw error;
    }
  }

  async getApplicationById(applicationId: string, userId: string) {
    try {
      const application = await this.applicationRepo.findById(applicationId, userId);
      if (!application) throw new NotFoundError("Application not found");
      return application;
    } catch (error) {
      throw error;
    }
  }

  async getStats(userId: string) {
    try {
      const grouped = await this.applicationRepo.countByStatus(userId);

      const byStatus = ALL_STATUSES.reduce<Record<ApplicationStatus, number>>(
        (acc, status) => {
          acc[status] = grouped.find(row => row.status === status)?._count._all ?? 0;
          return acc;
        },
        {} as Record<ApplicationStatus, number>,
      );

      const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      const active = byStatus.APPLIED + byStatus.INTERVIEWING + byStatus.OFFER;

      return { byStatus, total, active };
    } catch (error) {
      throw error;
    }
  }

  async createApplication(userId: string, data: CreateJobApplicationInput) {
    try {
      this.assertSalaryRange(data.salaryMin ?? null, data.salaryMax ?? null);

      if (data.resumeId) await this.assertResumeOwned(data.resumeId, userId);

      const status = data.status ?? "SAVED";
      const appliedAt = data.appliedAt ? new Date(data.appliedAt) : SUBMITTED_STATUSES.includes(status) ? new Date() : null;

      const createData: JobApplicationWriteData & { userId: string; company: string; role: string } = {
        userId,
        company: data.company.trim(),
        role: data.role.trim(),
        status,
        ...(appliedAt && { appliedAt }),
        ...(data.location && { location: data.location.trim() }),
        ...(data.workArrangement && { workArrangement: data.workArrangement }),
        ...(data.jobUrl && { jobUrl: data.jobUrl }),
        ...(data.source && { source: data.source.trim() }),
        ...(data.salaryMin !== undefined && { salaryMin: data.salaryMin }),
        ...(data.salaryMax !== undefined && { salaryMax: data.salaryMax }),
        ...(data.salaryCurrency && { salaryCurrency: data.salaryCurrency.toUpperCase() }),
        ...(data.notes && { notes: data.notes }),
        ...(data.resumeId && { resumeId: data.resumeId }),
      };

      return await this.applicationRepo.create(createData);
    } catch (error) {
      throw error;
    }
  }

  async updateApplication(applicationId: string, userId: string, data: JobApplicationWriteData & { appliedAt?: Date | null }) {
    try {
      const existing = await this.getApplicationById(applicationId, userId);

      const nextMin = data.salaryMin !== undefined ? data.salaryMin : existing.salaryMin;
      const nextMax = data.salaryMax !== undefined ? data.salaryMax : existing.salaryMax;
      this.assertSalaryRange(nextMin, nextMax);

      if (data.resumeId) await this.assertResumeOwned(data.resumeId, userId);

      const updateData: JobApplicationWriteData = { ...data };

      // Stamp appliedAt the first time an application leaves SAVED, unless the
      // client is explicitly setting the date itself.
      if (data.status && SUBMITTED_STATUSES.includes(data.status) && !existing.appliedAt && data.appliedAt === undefined) {
        updateData.appliedAt = new Date();
      }

      return await this.applicationRepo.update(applicationId, userId, updateData);
    } catch (error) {
      throw error;
    }
  }

  async deleteApplication(applicationId: string, userId: string) {
    try {
      await this.getApplicationById(applicationId, userId);
      return await this.applicationRepo.delete(applicationId, userId);
    } catch (error) {
      throw error;
    }
  }

  async linkNote(applicationId: string, userId: string, noteId: string) {
    try {
      const application = await this.getApplicationById(applicationId, userId);

      const note = await this.applicationRepo.findOwnedNote(noteId, userId);
      if (!note) throw new NotFoundError("Note not found");

      if (application.linkedNotes.some(link => link.noteId === noteId)) {
        throw new ConflictError("Note is already linked to this application");
      }

      return await this.applicationRepo.linkNote(applicationId, noteId);
    } catch (error) {
      throw error;
    }
  }

  async unlinkNote(applicationId: string, userId: string, noteId: string) {
    try {
      await this.getApplicationById(applicationId, userId);

      const { count } = await this.applicationRepo.unlinkNote(applicationId, noteId);
      if (count === 0) throw new NotFoundError("Note is not linked to this application");
    } catch (error) {
      throw error;
    }
  }

  async linkRecording(applicationId: string, userId: string, recordingId: string) {
    try {
      const application = await this.getApplicationById(applicationId, userId);

      const recording = await this.applicationRepo.findOwnedRecording(recordingId, userId);
      if (!recording) throw new NotFoundError("Recording not found");

      if (application.linkedRecordings.some(link => link.recordingId === recordingId)) {
        throw new ConflictError("Recording is already linked to this application");
      }

      return await this.applicationRepo.linkRecording(applicationId, recordingId);
    } catch (error) {
      throw error;
    }
  }

  async unlinkRecording(applicationId: string, userId: string, recordingId: string) {
    try {
      await this.getApplicationById(applicationId, userId);

      const { count } = await this.applicationRepo.unlinkRecording(applicationId, recordingId);
      if (count === 0) throw new NotFoundError("Recording is not linked to this application");
    } catch (error) {
      throw error;
    }
  }

  private assertSalaryRange(min: number | null, max: number | null) {
    if (min !== null && max !== null && min > max) {
      throw new BadRequestError("Minimum salary cannot be greater than maximum salary");
    }
  }

  private async assertResumeOwned(resumeId: string, userId: string) {
    const resume = await this.applicationRepo.findOwnedResume(resumeId, userId);
    if (!resume) throw new NotFoundError("Resume not found");
  }
}
