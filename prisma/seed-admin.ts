import { hashPassword } from "../src/lib/hash-password";
import { prisma } from "../src/lib/prisma";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  await prisma.user.update({ where: { email }, data: { role: "ADMIN", account_status: "ACTIVE" } });
  console.log(`Promoted ${email} to ADMIN (password unchanged)`);
} else {
  await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      first_name: "Elevra",
      last_name: "Admin",
      role: "ADMIN",
      has_validated_email: true,
      has_onboarded: true,
      settings: { create: {} },
    },
  });
  console.log(`Created ADMIN ${email}`);
}

await prisma.$disconnect();
