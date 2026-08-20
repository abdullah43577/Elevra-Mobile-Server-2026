import type { Request, Response } from "express";
import { AuthService } from "../services/auth.services";
import { SocialAuthService } from "../services/social-auth.service";
import type { SocialProvider } from "../lib/verify-social-token";
import type { IUserRequest } from "../interface";
import { signInSchema, signUpSchema, resetPasswordSchema, deleteAccountSchema, socialAuthSchema } from "../schemas/auth";
import { handleErrors } from "../lib/handle-errors";
import { BadRequestError } from "../lib/errors";
import type { UpdateProfile, UpdateSettings } from "../schemas/profile";

export class AuthController {
  private authService = new AuthService();
  private socialAuthService = new SocialAuthService();

  async testApi(req: Request, res: Response) {
    res.status(200).json({ message: "SERVERS ARE LIVE!!!" });
  }

  async createUser(req: IUserRequest, res: Response) {
    try {
      const data = signUpSchema.parse(req.body);

      const user = await this.authService.register(data);

      const { password, ...rest } = user;

      res.status(201).json({ message: "User Account Created Successfully", data: rest });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async verifyEmail(req: IUserRequest, res: Response) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) throw new BadRequestError("Email and OTP are required");

      await this.authService.verifyEmail(email, otp);

      res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async resendVerificationOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("Email is required");

      await this.authService.resendVerificationOtp(email);

      res.status(200).json({ message: "Verification code resent successfully" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async loginUser(req: IUserRequest, res: Response) {
    try {
      const data = signInSchema.parse(req.body);

      const result = await this.authService.login(data);
      // remove result from user object
      const { user, ...rest } = result;
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json({ message: "Login Successful", data: { user: userWithoutPassword, token: rest } });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  /*
    One handler for both providers. Sign-in and sign-up are the same request:
    the client cannot know whether the Google account it just authenticated has
    been here before, and asking it to guess would give us two endpoints that
    must behave identically anyway.
  */
  private async socialSignIn(provider: SocialProvider, req: IUserRequest, res: Response) {
    try {
      const data = socialAuthSchema.parse(req.body);

      const result = await this.socialAuthService.signIn(provider, data);

      const { user, ...rest } = result;
      const { password: _, ...userWithoutPassword } = user;

      // Deliberately the same shape as loginUser, so the client's existing
      // session handling works unchanged.
      res.status(200).json({ message: "Login Successful", data: { user: userWithoutPassword, token: rest } });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async googleSignIn(req: IUserRequest, res: Response) {
    return this.socialSignIn("GOOGLE", req, res);
  }

  async appleSignIn(req: IUserRequest, res: Response) {
    return this.socialSignIn("APPLE", req, res);
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("'Email', was not provided in the request body");

      await this.authService.forgotPassword(email);

      res.status(200).json({ message: "Reset Link sent to provided email address" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { email, otp, password } = resetPasswordSchema.parse(req.body);

      await this.authService.resetPassword(email, otp, password);

      res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const result = await this.authService.getProfile(userId as string);

      res.status(200).json({ message: "Profile fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateProfile(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const profilePic = req.file;

      const data = req.body as UpdateProfile;
      const result = await this.authService.updateProfile(userId as string, data, profilePic);
      res.status(200).json({ message: "Profile updated successfully!", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateProfileSettings(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const data = req.body as UpdateSettings;

      const result = await this.authService.updateProfileSettings(userId as string, data);
      res.status(200).json({ message: "Profile settings updated successfully!", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteAccount(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { password } = deleteAccountSchema.parse(req.body ?? {});

      await this.authService.deleteAccount(userId!, password);

      res.status(204).json({ message: "Account deleted successfully" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async generateNewToken(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const tokens = await this.authService.generateNewToken(userId!);

      res.status(200).json({ message: "Token refreshed", data: tokens });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
