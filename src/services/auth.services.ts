import { BadRequestError, NotFoundError } from "../lib/errors";
import { generateAccessToken, generateRefreshToken } from "../lib/generate-token";
import { getEnv } from "../lib/get-env";
import { comparePassword, hashPassword } from "../lib/hash-password";
import { UserRepository } from "../repositories/user.repository";
import type { SignInFormValues, SignUpFormValues } from "../schemas/auth";
import crypto from "crypto";
import { redis } from "../lib/redis-connection";
import { MailService } from "./mail.service";

const EMAIL_VERIFICATION_TOKEN = getEnv("EMAIL_VERIFICATION_TOKEN");

export class AuthService {
  private userRepo = new UserRepository();
  private mailService = new MailService();
  private static generateOTP = () => crypto.randomInt(100000, 1000000).toString();

  async register(data: SignUpFormValues) {
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
  }

  async verifyEmail(email: string, otp: string) {
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
  }

  async resendVerificationOtp(email: string) {
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
  }

  async login(data: SignInFormValues) {
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
  }

  async forgotPassword(email: string) {
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
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findUniqueUser({ id: userId }, { id: true, password: true });

    if (!user) throw new NotFoundError("User not found");

    const isMatch = await comparePassword(currentPassword, user.password!);

    if (!isMatch) throw new BadRequestError("Password Invalid");

    //# hash password
    const hashedPassword = await hashPassword(newPassword);

    await this.userRepo.updateUser(userId, { password: hashedPassword });

    return true;
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findById(userId);

    if (!user) throw new NotFoundError("User not found!");

    const { password, ...rest } = user;

    return rest;
  }

  async generateNewToken(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const accessToken = generateAccessToken({ id: userId });
    const refreshToken = generateRefreshToken({ id: userId });

    return { accessToken, refreshToken };
  }
}
