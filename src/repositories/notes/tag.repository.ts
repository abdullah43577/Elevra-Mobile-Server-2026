import { prisma } from "../../lib/prisma";

export class TagRepository {
  async findManyByUser(userId: string) {
    return prisma.tag.findMany({
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
    return prisma.tag.findFirst({
      where: { id, userId },
    });
  }

  async findByName(userId: string, name: string) {
    return prisma.tag.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });
  }

  async create(userId: string, name: string) {
    return prisma.tag.create({
      data: {
        userId,
        name,
      },
    });
  }

  async upsert(userId: string, name: string) {
    return prisma.tag.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: {},
      create: {
        userId,
        name,
      },
    });
  }

  async delete(id: string, userId: string) {
    return prisma.tag.delete({
      where: { id, userId },
    });
  }
}
