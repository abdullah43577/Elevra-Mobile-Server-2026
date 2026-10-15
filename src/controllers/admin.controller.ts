import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { getAdminUsersQuerySchema, updateUserStatusSchema, updateUserTierSchema } from "../schemas/admin";
import { AdminService } from "../services/admin.service";

export class AdminController {
  private adminService = new AdminService();

  async getStats(_req: IUserRequest, res: Response) {
    try {
      const stats = await this.adminService.getStats();
      res.status(200).json({ message: "Stats fetched successfully!", data: stats });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getUsers(req: IUserRequest, res: Response) {
    try {
      const query = getAdminUsersQuerySchema.parse(req.query);

      const users = await this.adminService.getUsers(query);
      res.status(200).json({ message: "Users fetched successfully!", data: users });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getUser(req: IUserRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await this.adminService.getUser(id as string);
      res.status(200).json({ message: "User fetched successfully!", data: user });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateUserStatus(req: IUserRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = updateUserStatusSchema.parse(req.body);

      const user = await this.adminService.updateUserStatus(id as string, status);
      res.status(200).json({ message: status === "ACTIVE" ? "User reinstated" : "User suspended", data: user });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateUserTier(req: IUserRequest, res: Response) {
    try {
      const { id } = req.params;
      const { tier } = updateUserTierSchema.parse(req.body);

      const user = await this.adminService.updateUserTier(id as string, tier);
      res.status(200).json({ message: tier === "PRO" ? "Pro granted" : "Complimentary Pro revoked", data: user });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteUser(req: IUserRequest, res: Response) {
    try {
      const { id } = req.params;

      await this.adminService.deleteUser(id as string);
      res.status(204).send();
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
