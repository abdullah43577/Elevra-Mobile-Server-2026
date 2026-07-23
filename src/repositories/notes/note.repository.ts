import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const noteInclude = {
  folder: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.NoteInclude;

// export type NoteWithRelations = Prisma.NoteGetPayload<{
//   include: typeof noteInclude;
// }>;

export class NoteRepository {
  async findManyByUser(
    userId: string,
    options?: {
      folderId?: string;
      isArchived?: boolean;
      search?: string;
    },
  ) {
    const { folderId, isArchived = false, search } = options || {};

    return prisma.note.findMany({
      where: {
        userId,
        ...(folderId && { folderId }),
        isArchived,
        ...(search && {
          OR: [{ title: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }],
        }),
      },
      include: noteInclude,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });
  }

  async findById(id: string, userId: string) {
    return prisma.note.findFirst({
      where: { id, userId },
      include: noteInclude,
    });
  }

  async create(data: { userId: string; title: string; content?: string; folderId?: string; tagIds?: string[] }) {
    const { tagIds, ...noteData } = data;

    return prisma.note.create({
      data: {
        ...noteData,
        ...(tagIds?.length && {
          noteTags: {
            create: tagIds.map(tagId => ({
              tagId,
            })),
          },
        }),
      },
      include: noteInclude,
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
      folderId?: string | null;
      isArchived?: boolean;
      isPinned?: boolean;
    },
  ) {
    return prisma.note.update({
      where: { id, userId },
      data,
      include: noteInclude,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.note.delete({
      where: { id, userId },
    });
  }

  async updateSummary(id: string, userId: string, summary: string) {
    return prisma.note.update({
      where: { id, userId },
      data: {
        aiSummary: summary,
        summaryGeneratedAt: new Date(),
      },
    });
  }
}
