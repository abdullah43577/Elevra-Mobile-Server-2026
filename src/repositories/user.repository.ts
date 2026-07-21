import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string, select?: Prisma.UserSelect) {
    return prisma.user.findUnique({
      where: { id },
      ...(select && { select }),
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data: { ...data, authProvider: "PASSWORD" } });
  }
}
