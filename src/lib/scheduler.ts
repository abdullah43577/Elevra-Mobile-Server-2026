import cron from "node-cron";
import { ReminderService } from "../services/reminder.service";
import { getEnv } from "./get-env";

const reminderService = new ReminderService();

/*
  A daily sweep, not a job per application. Reminders are time-based and
  idempotent — the cooldown on lastReminderAt means running twice is harmless
  and a missed run simply happens tomorrow — so this needs a scheduler, not a
  queue. BullMQ stays deferred until there is work that genuinely must not be
  lost (voice transcription).

  Note: this runs in-process. If the API is ever scaled past one instance, each
  one will fire its own sweep and users get duplicate reminders. Move it to a
  single worker (or take a Redis lock) before scaling out.
*/
export const startScheduler = function () {
  if (getEnv("DISABLE_SCHEDULER") === "true") {
    console.log("⏱️  Scheduler disabled by DISABLE_SCHEDULER");
    return;
  }

  // 09:00 every day, in the server's timezone.
  cron.schedule("0 9 * * *", async () => {
    try {
      const { reminded } = await reminderService.sweep();
      if (reminded > 0) console.log(`⏱️  Application reminders sent: ${reminded}`);
    } catch (error) {
      console.error("Reminder sweep failed:", error);
    }
  });

  console.log("⏱️  Reminder sweep scheduled for 09:00 daily");
};
