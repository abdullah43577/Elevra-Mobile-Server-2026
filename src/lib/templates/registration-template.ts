import { baseLayout } from "./layout";

export function registrationTemplate({ name, verificationUrl }: { name: string; verificationUrl: string }) {
  const content = `
    <h2 style="margin:0 0 12px; color:#18181b; font-size:20px;">Welcome to Elevra, ${name} 👋</h2>
    <p style="margin:0 0 24px; color:#52525b; font-size:14px; line-height:1.5;">
      Confirm your email to activate your account and start building.
    </p>
    <div style="text-align:center; margin:24px 0;">
      <a href="${verificationUrl}" style="display:inline-block; background:#18181b; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-size:14px; font-weight:600;">
        Verify Email
      </a>
    </div>
  `;
  return baseLayout(content);
}
