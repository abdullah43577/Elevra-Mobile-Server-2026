import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

/*
  The template's theme must be nested, not just the template. Every renderer —
  the on-screen preview and the PDF export alike — reads template.theme for its
  colours and spacing, so a bare `template: true` hands the client a template
  with an undefined theme and the export throws on the first colour lookup.
*/
const resumeInclude = {
  template: { include: { theme: true } },
  customTheme: true,
} satisfies Prisma.ResumeInclude;

export class ResumeRepository {
  async findManyByUser(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      include: resumeInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.resume.findFirst({
      where: { id, userId },
      include: resumeInclude,
    });
  }

  async create(data: { userId: string; title: string; templateId: string; personalInfo?: any; experience?: any; education?: any; skills?: any; languages?: any; certifications?: any; projects?: any; references?: any }) {
    const { userId, title, templateId, ...rest } = data;

    return prisma.resume.create({
      data: {
        userId,
        title,
        templateId,
        ...rest,
      },
      include: resumeInclude,
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      templateId?: string;
      personalInfo?: any;
      experience?: any;
      education?: any;
      skills?: any;
      languages?: any;
      certifications?: any;
      projects?: any;
      references?: any;
      isPublished?: boolean;
      lastExportedAt?: Date;
    },
  ) {
    return prisma.resume.update({
      where: { id, userId },
      data,
      include: resumeInclude,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.resume.delete({
      where: { id, userId },
    });
  }

  async updateLastExported(id: string, userId: string) {
    return prisma.resume.update({
      where: { id, userId },
      data: { lastExportedAt: new Date() },
    });
  }
}
