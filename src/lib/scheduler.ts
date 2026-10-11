import cron from "node-cron";
import { ReminderService } from "../services/reminder.service";
import { getEnv } from "./get-env";

const reminderService = new ReminderService();

// Runs in-process: past one instance, each fires its own sweep and users get duplicate
// reminders. Move it to a single worker or take a Redis lock before scaling out.
export const startScheduler = function () {
  if (getEnv("DISABLE_SCHEDULER") === "true") {
    console.log("⏱️  Scheduler disabled by DISABLE_SCHEDULER");
    return;
  }

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
