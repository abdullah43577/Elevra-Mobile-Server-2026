import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import {
  createJobApplicationSchema,
  getJobApplicationsQuerySchema,
  linkNoteSchema,
  linkRecordingSchema,
  updateJobApplicationSchema,
} from "../schemas/job-application";
import { JobApplicationService } from "../services/job-application.service";
import { ReminderService } from "../services/reminder.service";
import type { JobApplicationWriteData } from "../repositories/job-application.repository";

export class JobApplicationController {
  private applicationService = new JobApplicationService();
  private reminderService = new ReminderService();

  async getApplications(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { status, search, isArchived } = getJobApplicationsQuerySchema.parse(req.query);

      const applications = await this.applicationService.getApplications(userId!, {
        ...(status && { status }),
        ...(search && { search }),
        ...(isArchived !== undefined && { isArchived }),
      });

      res.status(200).json({ message: "Applications fetched successfully!", data: applications });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getStats(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const stats = await this.applicationService.getStats(userId!);
      res.status(200).json({ message: "Application stats fetched successfully!", data: stats });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  /*
    Runs the reminder sweep for the caller only. The scheduled job sweeps every
    user; this exists so reminders can be exercised without waiting for 09:00,
    and is safe to expose because it is scoped to req.userId.
  */
  async runReminders(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const data = await this.reminderService.sweep(userId!);
      res.status(200).json({ message: "Reminder sweep complete", data });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getApplicationById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const application = await this.applicationService.getApplicationById(id as string, userId!);
      res.status(200).json({ message: "Application retrieved successfully", data: application });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createApplication(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const payload = createJobApplicationSchema.parse(req.body);

      const application = await this.applicationService.createApplication(userId!, payload);
      res.status(201).json({ message: "Application created successfully", data: application });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateApplication(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const payload = updateJobApplicationSchema.parse(req.body);

      const updateData: JobApplicationWriteData = {
        ...(payload.company && { company: payload.company.trim() }),
        ...(payload.role && { role: payload.role.trim() }),
        ...(payload.location !== undefined && { location: payload.location }),
        ...(payload.workArrangement !== undefined && { workArrangement: payload.workArrangement }),
        ...(payload.jobUrl !== undefined && { jobUrl: payload.jobUrl }),
        ...(payload.source !== undefined && { source: payload.source }),
        ...(payload.salaryMin !== undefined && { salaryMin: payload.salaryMin }),
        ...(payload.salaryMax !== undefined && { salaryMax: payload.salaryMax }),
        ...(payload.salaryCurrency !== undefined && {
          salaryCurrency: payload.salaryCurrency ? payload.salaryCurrency.toUpperCase() : null,
        }),
        ...(payload.status && { status: payload.status }),
        ...(payload.appliedAt !== undefined && { appliedAt: payload.appliedAt ? new Date(payload.appliedAt) : null }),
        ...(payload.notes !== undefined && { notes: payload.notes }),
        ...(payload.resumeId !== undefined && { resumeId: payload.resumeId }),
        ...(payload.coverLetterId !== undefined && { coverLetterId: payload.coverLetterId }),
        ...(payload.isArchived !== undefined && { isArchived: payload.isArchived }),
      };

      const application = await this.applicationService.updateApplication(id as string, userId!, updateData);
      res.status(200).json({ message: "Application updated successfully", data: application });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteApplication(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.applicationService.deleteApplication(id as string, userId!);
      res.status(204).json({ message: "Application deleted successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async linkNote(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { noteId } = linkNoteSchema.parse(req.body);

      const link = await this.applicationService.linkNote(id as string, userId!, noteId);
      res.status(201).json({ message: "Note linked successfully", data: link });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async unlinkNote(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id, noteId } = req.params;

      await this.applicationService.unlinkNote(id as string, userId!, noteId as string);
      res.status(204).json({ message: "Note unlinked successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async linkRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { recordingId } = linkRecordingSchema.parse(req.body);

      const link = await this.applicationService.linkRecording(id as string, userId!, recordingId);
      res.status(201).json({ message: "Recording linked successfully", data: link });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async unlinkRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id, recordingId } = req.params;

      await this.applicationService.unlinkRecording(id as string, userId!, recordingId as string);
      res.status(204).json({ message: "Recording unlinked successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
