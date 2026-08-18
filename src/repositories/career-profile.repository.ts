import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

export interface CareerProfileWriteData {
  personalInfo?: Prisma.InputJsonValue;
  experience?: Prisma.InputJsonValue;
  education?: Prisma.InputJsonValue;
  skills?: Prisma.InputJsonValue;
  languages?: Prisma.InputJsonValue;
  certifications?: Prisma.InputJsonValue;
  projects?: Prisma.InputJsonValue;
  references?: Prisma.InputJsonValue;
}

export class CareerProfileRepository {
  async findByUser(userId: string) {
    return prisma.careerProfile.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: CareerProfileWriteData) {
    return prisma.careerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async delete(userId: string) {
    return prisma.careerProfile.delete({
      where: { userId },
    });
  }
}
