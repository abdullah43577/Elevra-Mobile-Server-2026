import { Router } from "express";
import { JobApplicationController } from "../controllers/job-application.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const jobApplicationController = new JobApplicationController();

router.use(validateAccessToken);

// Declared before "/:id" so it is not swallowed by the id param
router.get("/stats", jobApplicationController.getStats.bind(jobApplicationController));
router.post("/reminders/run", jobApplicationController.runReminders.bind(jobApplicationController));

router.get("/", jobApplicationController.getApplications.bind(jobApplicationController));
router.get("/:id", jobApplicationController.getApplicationById.bind(jobApplicationController));
router.post("/", jobApplicationController.createApplication.bind(jobApplicationController));
router.put("/:id", jobApplicationController.updateApplication.bind(jobApplicationController));
router.delete("/:id", jobApplicationController.deleteApplication.bind(jobApplicationController));

router.post("/:id/notes", jobApplicationController.linkNote.bind(jobApplicationController));
router.delete("/:id/notes/:noteId", jobApplicationController.unlinkNote.bind(jobApplicationController));

router.post("/:id/recordings", jobApplicationController.linkRecording.bind(jobApplicationController));
router.delete("/:id/recordings/:recordingId", jobApplicationController.unlinkRecording.bind(jobApplicationController));

export { router as jobApplicationRouter };
