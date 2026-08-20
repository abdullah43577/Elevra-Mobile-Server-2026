import { BadRequestError, EmailNotVerifiedError, NotFoundError } from "../lib/errors";
import { generateAccessToken, generateRefreshToken } from "../lib/generate-token";
import { getEnv } from "../lib/get-env";
import { comparePassword, hashPassword } from "../lib/hash-password";
import { UserRepository } from "../repositories/user.repository";
import type { SignInFormValues, SignUpFormValues } from "../schemas/auth";
import crypto from "crypto";
import { redis } from "../lib/redis-connection";
import { otpAttempts } from "../lib/rate-limit";
import { MailService } from "./mail.service";
import { CloudinaryService } from "./cloudinary.service";
import { VoiceRecordingRepository } from "../repositories/voice-recording.repository";
import { NotificationService } from "./notification.service";
import type { UpdateProfile, UpdateSettings } from "../schemas/profile";

export class AuthService {
  private userRepo = new UserRepository();
  private mailService = new MailService();
  private cloudinaryService = new CloudinaryService();
  private notificationService = new NotificationService();
  private voiceRecordingRepo = new VoiceRecordingRepository();
  private static generateOTP = () => crypto.randomInt(100000, 1000000).toString();

  /*
    Cooldown between verification emails for one account. Matches the resend
    button's own countdown on the client, so the two never disagree about when
    another code is available.
  */
  private static readonly VERIFY_OTP_COOLDOWN_SECONDS = 60;

  /*
    The one place a verification code is minted and mailed. register(),
    resendVerificationOtp() and login() all go through it — it existed as three
    copies before login() needed a fourth.

    `throttle` is only set on the login path. That send is a side effect of an
    action the user took for a different reason, so tapping Sign in a few times
    must not put a few more codes in their inbox; the explicit Resend button is
    where "send me another one right now" lives, and it is rate limited at the
    route.

    Returns whether a mail actually went out, so the caller can tell the user
    which of the two happened.
  */
  private async issueVerificationOtp(user: { id: string; email: string; first_name: string | null; last_name: string | null }, options?: { throttle?: boolean }) {
    if (options?.throttle) {
      const cooldownKey = `email-verify-cooldown:${user.id}`;

      // NX + EX in one call: set only if absent, and expire it. Checking then
      // setting would let two concurrent sign-ins both find it empty.
      const claimed = await redis.set(cooldownKey, "1", "EX", AuthService.VERIFY_OTP_COOLDOWN_SECONDS, "NX");

      if (!claimed) return false;
    }

    const otp = AuthService.generateOTP();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    await redis.set(`email-verify:${user.id}`, hashedOtp, "EX", 600);

    await this.mailService.sendVerifyEmail(user.email, {
      name: user.first_name ?? user.last_name ?? "User",
      otp,
    });

    return true;
  }

  async register(data: SignUpFormValues) {
    try {
      const existingUser = await this.userRepo.findByEmail(data.email);

      if (existingUser) throw new BadRequestError("User already exists");

      const hashedPassword = await hashPassword(data.password);

      const { deviceToken, deviceType, ...rest } = data;

      const user = await this.userRepo.createUser({
        ...rest,
        ...(deviceToken && { deviceToken }),
        ...(deviceType && { deviceType }),
        password: hashedPassword,
        has_onboarded: true,
      });

      await this.issueVerificationOtp(user);

      return user;
    } catch (error) {
      throw error;
    }
  }

  async verifyEmail(email: string, otp: string) {
    try {
      const user = await this.userRepo.findByEmail(email);
      if (!user) throw new NotFoundError("User not found");

      const stored = await redis.get(`email-verify:${user.id}`);
      if (!stored) throw new BadRequestError("OTP expired or invalid");

      const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
      if (hashedInput !== stored) throw new BadRequestError("Invalid OTP");

      await redis.del(`email-verify:${user.id}`);
      await this.userRepo.updateUser(user.id, { has_validated_email: true });

      await this.mailService.sendWelcome(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
      });

      await this.notificationService.notify({
        userId: user.id,
        type: "SYSTEM",
        title: "Welcome to Elevra",
        body: "Start by tracking a job application, writing a note, or building a resume.",
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationOtp(email: string) {
    try {
      const user = await this.userRepo.findByEmail(email);
      if (!user) throw new NotFoundError("User not found");

      if (user.has_validated_email) throw new BadRequestError("Email is already verified");

      await this.issueVerificationOtp(user);

      return true;
    } catch (error) {
      throw error;
    }
  }

  async login(data: SignInFormValues) {
    try {
      const user = await this.userRepo.findByEmail(data.email);

      if (!user) throw new BadRequestError("Invalid credentials");

      /*
        Gated on the *absence of a password*, not on the presence of a googleId.
        A password account that later links Google has both, and the old check
        locked it out of the credentials it was created with.
      */
      if (!user.password) {
        throw new BadRequestError(user.appleId && !user.googleId ? "Please sign in with Apple" : "Please sign in with Google");
      }

      const isMatch = await comparePassword(data.password, user.password);

      if (!isMatch) {
        await this.userRepo.incrementFailedLogin(user.id, user.failedLoginAttempts);

        throw new BadRequestError("Invalid credentials");
      }

      await this.userRepo.resetLoginAttempts(user.id);

      /*
        Checked *after* the password, not before, and that ordering is the whole
        safety of the send below.

        This used to be the first thing login() looked at, so anyone who knew
        the address of an account that had signed up but never verified could
        put mail in that inbox by posting rubbish at this endpoint. A code now
        only goes to someone who has already proved they hold the credentials,
        and a wrong password is still answered with a flat "Invalid
        credentials" that reveals nothing about the account's state.

        Throttled, so repeatedly tapping Sign in does not stack up codes. Either
        way the client gets EMAIL_NOT_VERIFIED and sends the user to the OTP
        screen — a code is waiting for them regardless of which branch ran.
      */
      if (!user.has_validated_email) {
        const sent = await this.issueVerificationOtp(user, { throttle: true });

        throw new EmailNotVerifiedError(
          sent
            ? "Your email isn't verified yet. We've sent a new code to your inbox."
            : "Your email isn't verified yet. Enter the code we already sent to your inbox.",
        );
      }

      const accessToken = generateAccessToken({
        id: user.id,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
      });

      return {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /*
    Always reports success, even for an address with no account.

    Returning 404 here let anyone test an email and learn whether it is
    registered — account enumeration, and a ready-made target list for
    credential stuffing. The caller cannot tell the difference; only someone
    with access to the inbox learns anything.
  */
  async forgotPassword(email: string) {
    try {
      const user = await this.userRepo.findByEmail(email);

      if (!user) return true;

      const otp = AuthService.generateOTP();
      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

      await redis.set(`password-reset:${user.id}`, hashedOtp, "EX", 600);

      await this.mailService.sendForgotPassword(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
        otp,
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /*
    Consumes the OTP that forgotPassword writes to `password-reset:{userId}`.

    That key was being created and emailed but never read — there was no route
    to consume it, so anyone who forgot their password was permanently locked
    out after the app told them to check their inbox.

    Deliberately does NOT reveal whether the email exists: an unknown address
    and a wrong code return the same error, so this cannot be used to enumerate
    accounts.
  */
  async resetPassword(email: string, otp: string, newPassword: string) {
    try {
      const user = await this.userRepo.findByEmail(email);
      const invalid = new BadRequestError("That code is invalid or has expired");

      if (!user) throw invalid;

      // A six-digit code is only 1,000,000 possibilities. Without an attempt
      // cap the reset flow is a viable route to account takeover.
      if (await otpAttempts.isExhausted("password-reset", user.id)) {
        await redis.del(`password-reset:${user.id}`);
        throw new BadRequestError("Too many incorrect codes. Request a new one.");
      }

      const stored = await redis.get(`password-reset:${user.id}`);
      if (!stored) throw invalid;

      const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");

      if (hashedInput !== stored) {
        await otpAttempts.record("password-reset", user.id, 600);
        throw invalid;
      }

      const hashedPassword = await hashPassword(newPassword);
      await this.userRepo.updateUser(user.id, {
        password: hashedPassword,
        // A successful reset proves ownership, so clear any login lockout.
        failedLoginAttempts: 0,
        isLocked: false,
      });

      await redis.del(`password-reset:${user.id}`);
      await otpAttempts.clear("password-reset", user.id);

      await this.mailService.sendPasswordChanged(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await this.userRepo.findUniqueUser(
        { id: userId },
        { id: true, password: true, email: true, first_name: true, last_name: true },
      );

      if (!user) throw new NotFoundError("User not found");

      const isMatch = await comparePassword(currentPassword, user.password!);

      if (!isMatch) throw new BadRequestError("Password Invalid");

      //# hash password
      const hashedPassword = await hashPassword(newPassword);

      await this.userRepo.updateUser(userId, { password: hashedPassword });

      await this.mailService.sendPasswordChanged(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /*
    Deleting the account is a right, not a request, so this is a hard delete of
    the row rather than a status flag. Every owned model declares
    `onDelete: Cascade` on its userId, which is what makes one delete enough —
    notes, resumes, applications, letters, answers, settings and notifications
    all go with it.

    The password check is the safeguard: an unlocked phone in the wrong hands
    should not be able to erase someone's work in two taps. Accounts with no
    password (a future OAuth provider) skip it, since there is nothing to check.
  */
  async deleteAccount(userId: string, password?: string) {
    try {
      const user = await this.userRepo.findUniqueUser({ id: userId }, { id: true, password: true });

      if (!user) throw new NotFoundError("User not found");

      if (user.password) {
        if (!password) throw new BadRequestError("Password is required to delete your account");

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) throw new BadRequestError("Password Invalid");
      }

      /*
        Uploaded audio is destroyed before the rows go, because the publicIds
        live on those rows and are unrecoverable afterwards. Deleting the record
        of someone's voice memos while leaving the files hosted would defeat the
        point of the feature.

        Two gaps, both structural: profile pictures and interview answer audio
        store a URL but no publicId, so they cannot be destroyed by handle. Add
        a publicId column to either and they can join this.
      */
      const publicIds = await this.voiceRecordingRepo.findPublicIdsByUser(userId);
      if (publicIds.length) {
        await this.cloudinaryService.destroyMany(publicIds, "auto");
      }

      await this.userRepo.deleteUser(userId);

      return true;
    } catch (error) {
      throw error;
    }
  }

  async getProfile(userId: string) {
    try {
      const user = await this.userRepo.findById(userId, {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        authProvider: true,
        profile_pic: true,
        gender: true,
        has_validated_email: true,
        googleId: true,
        failedLoginAttempts: true,
        isLocked: true,
        lastLogin: true,
        account_status: true,
        has_onboarded: true,
        deviceToken: true,
        deviceType: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
        professionId: true,
        profession: true,
        settings: true,
      });

      if (!user) throw new NotFoundError("User not found!");

      const { password, ...rest } = user;

      return rest;
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(userId: string, data: UpdateProfile, profilePic?: Express.Multer.File) {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError("User not found!");

      if (profilePic) {
        const result = await this.cloudinaryService.uploadFile(userId, profilePic, "avatar");
        const updatedUser = await this.userRepo.updateUser(userId!, { ...data, profile_pic: result.url } as any);
        return updatedUser;
      } else {
        return await this.userRepo.updateUser(userId, data);
      }
    } catch (error) {
      throw error;
    }
  }

  async updateProfileSettings(userId: string, data: UpdateSettings) {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError("User not found!");

      return await this.userRepo.upsertUserSettings(userId, data);
    } catch (error) {
      throw error;
    }
  }

  async generateNewToken(userId: string) {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError("User not found");

      const accessToken = generateAccessToken({ id: userId });
      const refreshToken = generateRefreshToken({ id: userId });

      return { accessToken, refreshToken };
    } catch (error) {
      throw error;
    }
  }
}
