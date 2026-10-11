import { BadRequestError, UnauthorizedError } from "../lib/errors";
import { generateAccessToken, generateRefreshToken } from "../lib/generate-token";
import { verifySocialToken, type SocialIdentity, type SocialProvider } from "../lib/verify-social-token";
import { UserRepository } from "../repositories/user.repository";
import type { SocialAuthValues } from "../schemas/auth";
import { MailService } from "./mail.service";
import { NotificationService } from "./notification.service";
import type { Prisma, User } from "../generated/prisma/client";

export class SocialAuthService {
  private userRepo = new UserRepository();
  private mailService = new MailService();
  private notificationService = new NotificationService();

  async signIn(provider: SocialProvider, data: SocialAuthValues) {
    const identity = await verifySocialToken(provider, data.idToken);

    // An unverified address must never match an existing account: matching by email is how a
    // social identity gets attached to one.
    if (identity.email && !identity.emailVerified) {
      throw new UnauthorizedError("That account's email address is not verified with its provider.");
    }

    const user = await this.findExisting(provider, identity);

    const account = user ? await this.link(user, provider, identity, data) : await this.create(provider, identity, data);

    return {
      user: account,
      tokens: {
        accessToken: generateAccessToken({ id: account.id }),
        refreshToken: generateRefreshToken({ id: account.id }),
      },
    };
  }

  private async findExisting(provider: SocialProvider, identity: SocialIdentity) {
    const byProvider = await this.userRepo.findByProviderId(provider, identity.providerId);
    if (byProvider) return byProvider;

    // The email fallback is only safe because the provider has already vouched the address is verified.
    return identity.email ? this.userRepo.findByEmail(identity.email) : null;
  }

  private async create(provider: SocialProvider, identity: SocialIdentity, data: SocialAuthValues) {
    if (!identity.email) {
      throw new BadRequestError("That account did not share an email address, so it cannot be used to sign in.");
    }

    const first_name = identity.first_name ?? data.first_name ?? null;
    const last_name = identity.last_name ?? data.last_name ?? null;

    const createData: Prisma.UserCreateInput = {
      email: identity.email,
      authProvider: provider,
      ...(provider === "GOOGLE" ? { googleId: identity.providerId } : { appleId: identity.providerId }),
      ...(first_name && { first_name }),
      ...(last_name && { last_name }),
      ...(identity.profile_pic && { profile_pic: identity.profile_pic }),
      has_validated_email: true,
      has_onboarded: true,
      ...(data.deviceToken && { deviceToken: data.deviceToken }),
      ...(data.deviceType && { deviceType: data.deviceType }),
    };

    const user = await this.userRepo.createSocialUser(createData);

    await this.mailService.sendWelcome(user.email, {
      name: user.first_name ?? user.last_name ?? "User",
    });

    await this.notificationService.notify({
      userId: user.id,
      type: "SYSTEM",
      title: "Welcome to Elevra",
      body: "Start by tracking a job application, writing a note, or building a resume.",
    });

    return user;
  }

  private async link(user: User, provider: SocialProvider, identity: SocialIdentity, data: SocialAuthValues) {
    if (user.account_status !== "ACTIVE") {
      throw new UnauthorizedError("This account is no longer active.");
    }

    const alreadyLinked = provider === "GOOGLE" ? user.googleId === identity.providerId : user.appleId === identity.providerId;

    // Pre-registration takeover: an unverified password signup on this address may be an attacker's,
    // so linking destroys the password; the real owner can reset it through their inbox.
    const stealPassword = !alreadyLinked && !user.has_validated_email && !!user.password;

    const first_name = identity.first_name ?? data.first_name ?? null;
    const last_name = identity.last_name ?? data.last_name ?? null;

    const updateData: Prisma.UserUpdateInput = {
      ...(provider === "GOOGLE" ? { googleId: identity.providerId } : { appleId: identity.providerId }),
      has_validated_email: true,
      lastLogin: new Date(),
      failedLoginAttempts: 0,
      isLocked: false,
      ...(stealPassword && { password: null }),
      // Only fills gaps, so a name changed in Profile is not overwritten on every sign-in.
      ...(!user.first_name && first_name && { first_name }),
      ...(!user.last_name && last_name && { last_name }),
      ...(!user.profile_pic && identity.profile_pic && { profile_pic: identity.profile_pic }),
      ...(data.deviceToken && { deviceToken: data.deviceToken }),
      ...(data.deviceType && { deviceType: data.deviceType }),
    };

    return this.userRepo.updateUser(user.id, updateData);
  }
}
