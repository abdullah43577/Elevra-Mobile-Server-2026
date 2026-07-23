import { prisma } from "../../lib/prisma";

export class FolderRepository {
  async findManyByUser(userId: string) {
    return prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.folder.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });
  }

  async create(data: { userId: string; name: string; color?: string }) {
    return prisma.folder.create({
      data,
    });
  }

  async update(id: string, userId: string, data: { name?: string; color?: string }) {
    return prisma.folder.update({
      where: { id, userId },
      data,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.folder.delete({
      where: { id, userId },
    });
  }
}
