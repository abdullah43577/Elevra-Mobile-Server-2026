import { BadRequestError, NotFoundError } from "../lib/errors";
import { generateAccessToken, generateRefreshToken } from "../lib/generate-token";
import { getEnv } from "../lib/get-env";
import { comparePassword, hashPassword } from "../lib/hash-password";
import { UserRepository } from "../repositories/user.repository";
import type { SignInFormValues, SignUpFormValues } from "../schemas/auth";
import crypto from "crypto";
import { redis } from "../lib/redis-connection";
import { MailService } from "./mail.service";
import { CloudinaryService } from "./cloudinary.service";
import type { UpdateProfile, UpdateSettings } from "../schemas/profile";

export class AuthService {
  private userRepo = new UserRepository();
  private mailService = new MailService();
  private cloudinaryService = new CloudinaryService();
  private static generateOTP = () => crypto.randomInt(100000, 1000000).toString();

  async register(data: SignUpFormValues) {
    try {
      const existingUser = await this.userRepo.findByEmail(data.email);

      if (existingUser) throw new BadRequestError("User already exists");

      const hashedPassword = await hashPassword(data.password);

      const user = await this.userRepo.createUser({
        ...data,
        password: hashedPassword,
        has_onboarded: true,
      });

      const otp = AuthService.generateOTP();
      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

      await redis.set(`email-verify:${user.id}`, hashedOtp, "EX", 600);

      await this.mailService.sendVerifyEmail(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
        otp,
      });

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

      const otp = AuthService.generateOTP();
      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

      await redis.set(`email-verify:${user.id}`, hashedOtp, "EX", 600);

      await this.mailService.sendVerifyEmail(user.email, {
        name: user.first_name ?? user.last_name ?? "User",
        otp,
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  async login(data: SignInFormValues) {
    try {
      const user = await this.userRepo.findByEmail(data.email);

      if (!user) throw new BadRequestError("Invalid credentials");

      if (!user.has_validated_email) throw new BadRequestError("Please verify your email before logging in");

      if (user.googleId) throw new BadRequestError("Please login using Google Sign-In");

      const isMatch = await comparePassword(data.password, user.password!);

      if (!isMatch) {
        await this.userRepo.incrementFailedLogin(user.id, user.failedLoginAttempts);

        throw new BadRequestError("Invalid credentials");
      }

      await this.userRepo.resetLoginAttempts(user.id);

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

  async forgotPassword(email: string) {
    try {
      const user = await this.userRepo.findByEmail(email);

      if (!user) throw new NotFoundError("User not found");

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

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await this.userRepo.findUniqueUser({ id: userId }, { id: true, password: true });

      if (!user) throw new NotFoundError("User not found");

      const isMatch = await comparePassword(currentPassword, user.password!);

      if (!isMatch) throw new BadRequestError("Password Invalid");

      //# hash password
      const hashedPassword = await hashPassword(newPassword);

      await this.userRepo.updateUser(userId, { password: hashedPassword });

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
