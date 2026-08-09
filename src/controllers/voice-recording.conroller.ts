import { type Response } from "express";
import { VoiceRecordingService } from "../services/voice-recording.service";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { createVoiceRecordingSchema, getRecordingsQuerySchema, updateVoiceRecordingSchema } from "../schemas/voice-notes";

export class VoiceRecordingController {
  private voiceService = new VoiceRecordingService();

  async getRecordings(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { search, isTranscribed } = getRecordingsQuerySchema.parse(req.query);

      const recordings = await this.voiceService.getRecordings(userId!, {
        search: search as string,
        isTranscribed: isTranscribed as boolean,
      });

      res.status(200).json({
        message: "Recordings fetched successfully!",
        data: recordings,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getRecordingById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const recording = await this.voiceService.getRecordingById(id as string, userId!);

      res.status(200).json({
        message: "Recording retrieved successfully",
        data: recording,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const audioFile = req.file;

      console.log(req.body, "step 1");
      const { title, duration, fileSize } = createVoiceRecordingSchema.parse(req.body);

      console.log(title, duration, fileSize, "let's go");

      const recording = await this.voiceService.createRecording(
        userId!,
        {
          title,
          duration,
          ...(fileSize && { fileSize }),
        },
        audioFile,
      );

      res.status(201).json({
        message: "Recording created successfully",
        data: recording,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { title, transcription, isTranscribed } = updateVoiceRecordingSchema.parse(req.body);

      const updateData: {
        title?: string;
        transcription?: string;
        isTranscribed?: boolean;
      } = {
        ...(title && { title }),
        ...(transcription !== undefined && { transcription }),
        ...(isTranscribed !== undefined && { isTranscribed }),
      };

      const recording = await this.voiceService.updateRecording(id as string, userId!, updateData);

      res.status(200).json({
        message: "Recording updated successfully",
        data: recording,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.voiceService.deleteRecording(id as string, userId!);

      res.status(204).json({
        message: "Recording deleted successfully!",
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  // 🔒 AI Transcription - Coming Soon
  async transcribeRecording(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const result = await this.voiceService.transcribeRecording(id as string, userId!);

      res.status(200).json({
        message: "Transcription started successfully",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
