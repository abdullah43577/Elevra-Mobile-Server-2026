import { Router } from "express";
import { MaintenanceController } from "../controllers/maintenance.controller";

const router = Router();
const maintenanceController = new MaintenanceController();

/*
  Deliberately not behind validateAccessToken: there is no user here. It is
  driven by a platform cron job and guarded by CRON_SECRET instead.
*/
router.post(
  "/reminders/sweep",
  maintenanceController.runReminderSweep.bind(maintenanceController),
);

export { router as maintenanceRouter };
