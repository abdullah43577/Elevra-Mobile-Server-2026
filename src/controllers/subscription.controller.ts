import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { SubscriptionService } from "../services/subscription.service";

export class SubscriptionController {
  private subscriptionService = new SubscriptionService();

  async getSubscription(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;

      const subscription = await this.subscriptionService.getSubscription(userId!);

      res.status(200).json({
        message: "Subscription fetched successfully!",
        data: subscription,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async syncSubscription(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;

      const subscription = await this.subscriptionService.syncSubscription(userId!);

      res.status(200).json({
        message: "Subscription synced successfully!",
        data: subscription,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
