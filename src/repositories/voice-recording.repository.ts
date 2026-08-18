import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

export class VoiceRecordingRepository {
  // Account deletion needs the Cloudinary handles before the rows cascade away.
  async findPublicIdsByUser(userId: string) {
    const rows = await prisma.voiceRecording.findMany({
      where: { userId, publicId: { not: null } },
      select: { publicId: true },
    });

    return rows.map(row => row.publicId!).filter(Boolean);
  }

  async findManyByUser(
    userId: string,
    options?: {
      search?: string;
      isTranscribed?: boolean;
    },
  ) {
    const { search, isTranscribed } = options || {};

    const where: Prisma.VoiceRecordingWhereInput = {
      userId,
      ...(isTranscribed !== undefined && { isTranscribed }),
      ...(search && {
        title: {
          contains: search,
          mode: "insensitive",
        },
      }),
    };

    return prisma.voiceRecording.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.voiceRecording.findFirst({
      where: { id, userId },
    });
  }

  async create(data: { userId: string; title: string; duration: number; fileUrl: string; fileSize?: number; publicId: string }) {
    const { userId, title, duration, fileUrl, fileSize, publicId } = data;

    const createData: Prisma.VoiceRecordingUncheckedCreateInput = {
      userId,
      title,
      duration,
      fileUrl,
      publicId,
      ...(fileSize && { fileSize }),
    };

    return prisma.voiceRecording.create({
      data: createData,
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      transcription?: string;
      isTranscribed?: boolean;
    },
  ) {
    const { title, transcription, isTranscribed } = data;

    const updateData: Prisma.VoiceRecordingUncheckedUpdateInput = {
      ...(title && { title }),
      ...(transcription !== undefined && { transcription }),
      ...(isTranscribed !== undefined && { isTranscribed }),
    };

    return prisma.voiceRecording.update({
      where: { id, userId },
      data: updateData,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.voiceRecording.delete({
      where: { id, userId },
    });
  }

  async updateTranscription(id: string, userId: string, transcription: string) {
    return prisma.voiceRecording.update({
      where: { id, userId },
      data: {
        transcription,
        isTranscribed: true,
      },
    });
  }
}
