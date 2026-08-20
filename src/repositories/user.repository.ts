import type { $Enums, Prisma } from "../generated/prisma/client";
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

  /*
    Separate from createUser because that one pins authProvider to PASSWORD.
    Widening it to read the flag from `data` would let any future caller create
    a GOOGLE account through the password path by passing one extra key.
  */
  async createSocialUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async findByProviderId(provider: "GOOGLE" | "APPLE", providerId: string) {
    return prisma.user.findUnique({
      where: provider === "GOOGLE" ? { googleId: providerId } : { appleId: providerId },
    });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async upsertUserSettings(userId: string, data: Partial<{ theme: $Enums.Theme; notifications: boolean; subscriptionTier: $Enums.SubscriptionTier }>) {
    return prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async incrementFailedLogin(id: string, attempts: number) {
    return prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: {
          increment: 1,
        },
        ...(attempts >= 5 && { isLocked: true }),
      },
    });
  }

  async resetLoginAttempts(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
      },
    });
  }

  async findUniqueUser(where: Prisma.UserWhereUniqueInput, select?: Prisma.UserSelect) {
    return prisma.user.findUnique({ where, ...(select && { select }) });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id } });
  }

  async findManyByEmails(emails: string[], select?: Prisma.UserSelect) {
    return prisma.user.findMany({
      where: { email: { in: emails } },
      select: select ?? { id: true, email: true, first_name: true, last_name: true },
    });
  }

  async findManyByIds(ids: string[], select?: Prisma.UserSelect) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: select ?? { id: true, email: true, first_name: true, last_name: true },
    });
  }
}
