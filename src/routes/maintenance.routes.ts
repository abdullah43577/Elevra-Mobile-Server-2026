import { Router } from "express";
import { MaintenanceController } from "../controllers/maintenance.controller";

const router = Router();
const maintenanceController = new MaintenanceController();

// Not behind validateAccessToken: driven by a platform cron, guarded by CRON_SECRET.
router.post(
  "/reminders/sweep",
  maintenanceController.runReminderSweep.bind(maintenanceController),
);

export { router as maintenanceRouter };
