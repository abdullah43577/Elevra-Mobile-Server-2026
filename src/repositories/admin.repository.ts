import type { $Enums, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const adminUserSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  authProvider: true,
  profile_pic: true,
  has_validated_email: true,
  account_status: true,
  role: true,
  lastLogin: true,
  createdAt: true,
  settings: { select: { subscriptionTier: true, proGrantedAt: true } },
} satisfies Prisma.UserSelect;

const adminUserDetailSelect = {
  ...adminUserSelect,
  gender: true,
  has_onboarded: true,
  deviceType: true,
  updatedAt: true,
  profession: { select: { name: true } },
  subscription: { select: { isActive: true, expiresAt: true, lastSyncedAt: true } },
  _count: {
    select: {
      jobApplications: true,
      resumes: true,
      coverLetters: true,
      notes: true,
      voiceRecordings: true,
      interviewAnswers: true,
    },
  },
} satisfies Prisma.UserSelect;

// The one repository that reads across users: every route reaching it sits behind validateAdminSession.
export class AdminRepository {
  async findManyUsers(where: Prisma.UserWhereInput, skip: number, take: number) {
    return prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }

  async countUsers(where: Prisma.UserWhereInput) {
    return prisma.user.count({ where });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: adminUserDetailSelect,
    });
  }

  async updateAccountStatus(id: string, status: $Enums.AccountStatus) {
    return prisma.user.update({
      where: { id },
      data: { account_status: status },
      select: { id: true },
    });
  }

  async updateTier(userId: string, data: { subscriptionTier: $Enums.SubscriptionTier; proGrantedAt: Date | null }) {
    return prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async getStats(since: Date) {
    const userWhere = { role: "USER" } satisfies Prisma.UserWhereInput;

    const [totalUsers, newUsers, proUsers, suspendedUsers, applications, resumes, coverLetters, recentUsers] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.user.count({ where: { ...userWhere, createdAt: { gte: since } } }),
      prisma.user.count({ where: { ...userWhere, settings: { subscriptionTier: "PRO" } } }),
      prisma.user.count({ where: { ...userWhere, account_status: "DEACTIVATED" } }),
      prisma.jobApplication.count(),
      prisma.resume.count(),
      prisma.coverLetter.count(),
      prisma.user.findMany({ where: userWhere, select: adminUserSelect, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    return { totalUsers, newUsers, proUsers, suspendedUsers, applications, resumes, coverLetters, recentUsers };
  }
}
