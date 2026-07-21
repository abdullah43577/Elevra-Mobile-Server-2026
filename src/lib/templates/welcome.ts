import { baseLayout } from "./layout";

export function welcomeTemplate({ name }: { name: string }) {
  const content = `
    <h2 style="margin:0 0 12px; color:#18181b; font-size:20px;">Welcome to Elevra, ${name} 👋</h2>
    <p style="margin:0; color:#52525b; font-size:14px; line-height:1.5;">
      Your AI workspace for career growth and productivity is ready. Let's get your first resume started.
    </p>
  `;
  return baseLayout(content);
}
