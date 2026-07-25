import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

export class TemplateRepository {
  async findMany(options?: { category?: string; isPremium?: boolean; search?: string }) {
    const { category, isPremium, search } = options || {};

    const where: Prisma.TemplateWhereInput = {
      isActive: true,
      ...(category && { category }),
      ...(isPremium !== undefined && { isPremium }),
      ...(search && {
        OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }],
      }),
    };

    return prisma.template.findMany({
      where,
      orderBy: [{ isPremium: "desc" }, { name: "asc" }],
    });
  }

  async findById(id: string) {
    return prisma.template.findUnique({
      where: { id, isActive: true },
    });
  }

  // Admin methods (for seeding)
  async create(data: { name: string; description?: string; thumbnail: string; category: string; sections?: any; styles?: any; isPremium?: boolean }) {
    return prisma.template.create({
      data,
    });
  }

  async seedTemplates(templates: any[]) {
    return prisma.template.createMany({
      data: templates,
      skipDuplicates: true,
    });
  }
}
