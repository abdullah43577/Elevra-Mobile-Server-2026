import crypto from "crypto";
import { type Request, type Response } from "express";
import { UnauthorizedError } from "../lib/errors";
import { getEnv } from "../lib/get-env";
import { handleErrors } from "../lib/handle-errors";
import { ReminderService } from "../services/reminder.service";

// Hash both sides first: timingSafeEqual throws on a length mismatch.
const matchesSecret = function (provided: string, expected: string) {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();

  return crypto.timingSafeEqual(a, b);
};

export class MaintenanceController {
  private reminderService = new ReminderService();

  // For hosts that sleep when idle and never fire the in-process cron. The sweep is idempotent.
  async runReminderSweep(req: Request, res: Response) {
    try {
      const secret = getEnv("CRON_SECRET");

      // No secret configured keeps the endpoint shut rather than open.
      if (!secret) throw new UnauthorizedError("Maintenance endpoints are disabled");

      const provided = req.headers.authorization?.replace(/^Bearer /, "");

      if (!provided || !matchesSecret(provided, secret)) {
        throw new UnauthorizedError("Invalid maintenance credentials");
      }

      const result = await this.reminderService.sweep();

      res.status(200).json({
        message: "Reminder sweep completed",
        data: result,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
