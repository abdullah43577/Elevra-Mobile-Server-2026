import { VoiceRecordingRepository } from "../repositories/voice-recording.repository";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { CloudinaryService } from "./cloudinary.service";

export class VoiceRecordingService {
  private voiceRepo = new VoiceRecordingRepository();
  private cloudinaryService = new CloudinaryService();

  async getRecordings(
    userId: string,
    options?: {
      search?: string;
      isTranscribed?: boolean;
    },
  ) {
    return this.voiceRepo.findManyByUser(userId, options);
  }

  async getRecordingById(recordingId: string, userId: string) {
    const recording = await this.voiceRepo.findById(recordingId, userId);
    if (!recording) throw new NotFoundError("Recording not found");

    return recording;
  }

  async createRecording(
    userId: string,
    data: {
      title: string;
      duration: number;
      fileSize?: number;
      publicId?: string;
    },
    audioFile?: Express.Multer.File,
  ) {
    if (!data.title.trim()) throw new BadRequestError("Recording title is required");

    if (data.duration <= 0) throw new BadRequestError("Recording duration must be greater than 0");

    if (!audioFile) throw new BadRequestError("Audio file is required");

    const result = await this.cloudinaryService.uploadFile(userId, audioFile, "auto");

    return this.voiceRepo.create({
      userId,
      title: data.title.trim(),
      duration: data.duration,
      fileUrl: result.secure_url,
      publicId: result.public_id,
      ...(data.fileSize && { fileSize: data.fileSize }),
    });
  }

  async updateRecording(
    recordingId: string,
    userId: string,
    data: {
      title?: string;
      transcription?: string;
      isTranscribed?: boolean;
    },
  ) {
    // Verify recording exists
    await this.getRecordingById(recordingId, userId);
    return this.voiceRepo.update(recordingId, userId, data);
  }

  async deleteRecording(recordingId: string, userId: string) {
    const recording = await this.getRecordingById(recordingId, userId);

    // Delete from Cloudinary if publicId exists
    if (recording.publicId) {
      try {
        await this.cloudinaryService.deleteFile({
          userId,
          publicId: recording.publicId,
          resource_type: "auto",
        });
      } catch (error) {
        console.error("Failed to delete audio from Cloudinary:", error);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    return this.voiceRepo.delete(recordingId, userId);
  }

  // 🔒 AI Transcription - Coming Soon
  async transcribeRecording(recordingId: string, userId: string) {
    const recording = await this.getRecordingById(recordingId, userId);

    // TODO: Implement AI transcription using Gemini
    // This will be added after the quota resets

    throw new Error("AI transcription coming soon!");
  }
}
