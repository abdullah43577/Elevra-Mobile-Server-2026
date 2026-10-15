import type { NextFunction, Response } from "express";
import type { IUserRequest } from "../interface";
import { UserRepository } from "../repositories/user.repository";
import { ForbiddenError } from "./errors";
import { handleErrors } from "./handle-errors";

const userRepo = new UserRepository();

// Runs after validateAccessToken. The role is read fresh each request, so a demoted or suspended admin loses access at once.
export const validateAdminSession = async function (req: IUserRequest, res: Response, next: NextFunction) {
  try {
    const user = await userRepo.findById(req.userId!, { role: true, account_status: true });

    if (user?.role !== "ADMIN" || user.account_status !== "ACTIVE") {
      throw new ForbiddenError("Admin access required");
    }

    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};
