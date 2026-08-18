import { prisma } from "../lib/prisma";

export interface SubscriptionWriteData {
  entitlementId?: string | null;
  isActive: boolean;
  expiresAt?: Date | null;
  lastSyncedAt: Date;
}

export class SubscriptionRepository {
  async findByUser(userId: string) {
    return prisma.subscription.findUnique({ where: { userId } });
  }

  async upsertForUser(userId: string, data: SubscriptionWriteData) {
    return prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
