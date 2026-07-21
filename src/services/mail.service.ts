import { sendMail, type Attachment } from "../lib/send-mail";
import { forgotPasswordTemplate } from "../lib/templates/forgot-password";
import { registrationTemplate } from "../lib/templates/registration-template";
import { verifyEmailTemplate } from "../lib/templates/verify-email";
import { welcomeTemplate } from "../lib/templates/welcome";

export class MailService {
  async sendForgotPassword(to: string, data: { name: string; otp: string }) {
    return sendMail({
      email: to,
      subject: "Reset your Elevra password",
      message: forgotPasswordTemplate(data),
    });
  }

  async sendVerifyEmail(to: string, data: { name: string; otp: string }) {
    return sendMail({
      email: to,
      subject: "Verify your Elevra account",
      message: verifyEmailTemplate(data),
    });
  }

  async sendWelcome(to: string, data: { name: string }) {
    return sendMail({
      email: to,
      subject: "Welcome to Elevra 🎉",
      message: welcomeTemplate(data),
    });
  }

  async sendRegistrationVerification(to: string, data: { name: string; verificationUrl: string }) {
    return sendMail({
      email: to,
      subject: "Verify your Elevra account",
      message: registrationTemplate(data),
    });
  }

  async sendWithAttachments(to: string, subject: string, html: string, attachments: Attachment[]) {
    return sendMail({
      email: to,
      subject,
      message: html,
      attachments,
    });
  }
}
