import { transcribe } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../lib/entitlements";
import { BadRequestError, NoSpeechError, NotFoundError } from "../lib/errors";
import { fetchStoredAudio } from "../lib/remote-audio";
import { VoiceRecordingRepository } from "../repositories/voice-recording.repository";
import { CloudinaryService } from "./cloudinary.service";
import { NotificationService } from "./notification.service";

export class VoiceRecordingService {
  private voiceRepo = new VoiceRecordingRepository();
  private cloudinaryService = new CloudinaryService();
  private notificationService = new NotificationService();

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
    await this.getRecordingById(recordingId, userId);
    return this.voiceRepo.update(recordingId, userId, data);
  }

  async deleteRecording(recordingId: string, userId: string) {
    const recording = await this.getRecordingById(recordingId, userId);

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

  async transcribeRecording(recordingId: string, userId: string) {
    await assertPro(userId, PRO_FEATURES.VOICE_TRANSCRIPTION);

    const recording = await this.getRecordingById(recordingId, userId);
    if (recording.isTranscribed && recording.transcription) return recording;

    const audio = await fetchStoredAudio(recording.fileUrl);
    await consumeAiQuota(userId);

    const transcription = await transcribe(audio.bytes, { filename: audio.filename });
    if (!transcription) throw new NoSpeechError();

    const updated = await this.voiceRepo.update(recordingId, userId, { transcription, isTranscribed: true });

    await this.notificationService.notify({
      userId,
      type: "VOICE_TRANSCRIPTION",
      title: "Transcription ready",
      body: recording.title,
      entityType: "recording",
      entityId: recordingId,
    });

    return updated;
  }
}
