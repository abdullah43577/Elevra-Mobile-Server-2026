import type { $Enums, Prisma } from "../generated/prisma/client";
import { isProForEveryone } from "../lib/entitlements";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { AdminRepository } from "../repositories/admin.repository";
import type { AdminUsersQuery } from "../schemas/admin";
import { AuthService } from "./auth.services";

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export class AdminService {
  private adminRepo = new AdminRepository();
  private authService = new AuthService();

  async getStats() {
    const stats = await this.adminRepo.getStats(new Date(Date.now() - NEW_USER_WINDOW_MS));

    return { ...stats, proForEveryone: isProForEveryone() };
  }

  async getUsers(query: AdminUsersQuery) {
    const { search, status, tier, page, limit } = query;

    const where: Prisma.UserWhereInput = {
      role: "USER",
      ...(status && { account_status: status }),
      ...(tier === "PRO" && { settings: { subscriptionTier: "PRO" } }),
      ...(tier === "FREE" && { NOT: { settings: { subscriptionTier: "PRO" } } }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.adminRepo.findManyUsers(where, (page - 1) * limit, limit),
      this.adminRepo.countUsers(where),
    ]);

    return { data: users, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // Admin accounts answer 404 here, which also stops an admin acting on themselves.
  async getUser(id: string) {
    const user = await this.adminRepo.findUserById(id);
    if (!user || user.role !== "USER") throw new NotFoundError("User not found");

    return user;
  }

  async updateUserStatus(id: string, status: $Enums.AccountStatus) {
    const user = await this.getUser(id);

    if (user.account_status === status) {
      throw new BadRequestError(status === "ACTIVE" ? "This user is already active" : "This user is already suspended");
    }

    await this.adminRepo.updateAccountStatus(id, status);

    return this.getUser(id);
  }

  async updateUserTier(id: string, tier: $Enums.SubscriptionTier) {
    const user = await this.getUser(id);
    const hasGrant = !!user.settings?.proGrantedAt;

    if (tier === "PRO") {
      if (hasGrant) throw new BadRequestError("This user already has complimentary Pro");

      await this.adminRepo.updateTier(id, { subscriptionTier: "PRO", proGrantedAt: new Date() });
    } else {
      if (!hasGrant) throw new BadRequestError("This user has no complimentary Pro to revoke");

      // A paying subscriber keeps Pro: revoking only removes the grant.
      const isPaying = !!user.subscription?.isActive;
      await this.adminRepo.updateTier(id, { subscriptionTier: isPaying ? "PRO" : "FREE", proGrantedAt: null });
    }

    return this.getUser(id);
  }

  async deleteUser(id: string) {
    await this.getUser(id);

    return this.authService.removeAccount(id);
  }
}
