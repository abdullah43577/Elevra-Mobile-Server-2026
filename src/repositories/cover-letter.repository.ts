import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

/*
  The template's theme must be nested, not just the template — the letter's
  preview and its exported PDF both read template.theme for colour, font and
  spacing. Same trap as resumeInclude.
*/
const coverLetterInclude = {
  template: { include: { theme: true } },
} satisfies Prisma.CoverLetterInclude;

export interface CoverLetterWriteData {
  title?: string;
  templateId?: string;
  personalInfo?: Prisma.InputJsonValue;
  company?: string;
  role?: string;
  recipientName?: string | null;
  recipientTitle?: string | null;
  companyAddress?: string | null;
  body?: string;
  closing?: string | null;
}

export class CoverLetterRepository {
  async findManyByUser(userId: string, filters: { search?: string } = {}) {
    const where: Prisma.CoverLetterWhereInput = {
      userId,
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { company: { contains: filters.search, mode: "insensitive" } },
          { role: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.coverLetter.findMany({
      where,
      include: coverLetterInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.coverLetter.findFirst({
      where: { id, userId },
      include: coverLetterInclude,
    });
  }

  async create(
    data: CoverLetterWriteData & {
      userId: string;
      title: string;
      templateId: string;
      company: string;
      role: string;
      body: string;
    },
  ) {
    return prisma.coverLetter.create({
      data,
      include: coverLetterInclude,
    });
  }

  async update(id: string, userId: string, data: CoverLetterWriteData) {
    return prisma.coverLetter.update({
      where: { id, userId },
      data,
      include: coverLetterInclude,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.coverLetter.delete({ where: { id, userId } });
  }

  async updateLastExported(id: string, userId: string) {
    return prisma.coverLetter.update({
      where: { id, userId },
      data: { lastExportedAt: new Date() },
    });
  }
}
