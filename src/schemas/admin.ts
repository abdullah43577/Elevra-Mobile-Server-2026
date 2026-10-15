import { z } from "zod";

export const getAdminUsersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
  tier: z.enum(["FREE", "PRO"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DEACTIVATED"]),
});

export const updateUserTierSchema = z.object({
  tier: z.enum(["FREE", "PRO"]),
});

export type AdminUsersQuery = z.infer<typeof getAdminUsersQuerySchema>;
