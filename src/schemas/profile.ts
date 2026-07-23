import type { $Enums } from "../generated/prisma/client";

export type UpdateProfile = {
  first_name?: string;
  last_name?: string;
  gender?: $Enums.Gender;
  professionId?: string;
};

export type UpdateSettings = { theme: $Enums.Theme; notifications: boolean };
