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

    /*
      An unverified address must never be allowed to match an existing account,
      because matching by email is how a social identity gets attached to one.
      Rejecting outright rather than falling back to provider-id-only matching:
      an account whose address the provider will not vouch for is not an account
      we want to create either.
    */
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

    /*
      Falling back to the email is what stops someone who signed up with a
      password from ending up with a second, empty account the first time they
      tap the Google button. It is only safe because the provider asserts the
      address is verified — which is checked before this runs.
    */
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
      // The provider already proved the address. Sending our own OTP would ask
      // the user to verify something Google or Apple just verified.
      has_validated_email: true,
      has_onboarded: true,
      ...(data.deviceToken && { deviceToken: data.deviceToken }),
      ...(data.deviceType && { deviceType: data.deviceType }),
    };

    const user = await this.userRepo.createSocialUser(createData);

    // Mirrors what verifyEmail does for a password signup: that is the moment a
    // password account becomes real, and this is the equivalent moment here.
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

    /*
      Pre-registration account takeover, and the reason this branch exists.

      Anyone can sign up with a password against an address they do not own —
      the account just sits unverified, and login() refuses it. But linking a
      social identity to it sets has_validated_email, which would bring that
      attacker-chosen password to life against the real owner's account.

      The provider owns the address; an unverified signup does not. So the
      password is destroyed on the way in. The genuine user can set a new one
      through the ordinary reset flow, which now requires the inbox they hold.
    */
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
      // Only fills gaps. A user who renamed themselves in Profile must not have
      // it overwritten by their Google display name on every sign-in.
      ...(!user.first_name && first_name && { first_name }),
      ...(!user.last_name && last_name && { last_name }),
      ...(!user.profile_pic && identity.profile_pic && { profile_pic: identity.profile_pic }),
      ...(data.deviceToken && { deviceToken: data.deviceToken }),
      ...(data.deviceType && { deviceType: data.deviceType }),
    };

    return this.userRepo.updateUser(user.id, updateData);
  }
}
