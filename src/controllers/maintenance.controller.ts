import crypto from "crypto";
import { type Request, type Response } from "express";
import { UnauthorizedError } from "../lib/errors";
import { getEnv } from "../lib/get-env";
import { handleErrors } from "../lib/handle-errors";
import { ReminderService } from "../services/reminder.service";

/*
  Timing-safe, and length-safe: timingSafeEqual throws on a length mismatch, so
  comparing a guess of the wrong length would crash rather than reject. Hashing
  both sides first makes every comparison the same width.
*/
const matchesSecret = function (provided: string, expected: string) {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();

  return crypto.timingSafeEqual(a, b);
};

export class MaintenanceController {
  private reminderService = new ReminderService();

  /*
    The reminder sweep, exposed so an external scheduler can drive it.

    The in-process cron in `lib/scheduler.ts` is fine on a machine that stays
    up, but a host that sleeps when idle — Render's free tier, for one — simply
    never fires it, and nothing errors to say so. Set DISABLE_SCHEDULER=true
    there and point a platform cron job at this instead. Running both is
    harmless anyway: the sweep is idempotent and the lastReminderAt cooldown
    absorbs a double run.
  */
  async runReminderSweep(req: Request, res: Response) {
    try {
      const secret = getEnv("CRON_SECRET");

      // No secret configured means the endpoint stays shut, rather than open.
      // An unauthenticated trigger for a job that emails users is not something
      // to leave running on a default.
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
