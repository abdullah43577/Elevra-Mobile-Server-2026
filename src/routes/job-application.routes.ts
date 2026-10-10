import { Router } from "express";
import { JobApplicationController } from "../controllers/job-application.controller";
import { rateLimit } from "../lib/rate-limit";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const jobApplicationController = new JobApplicationController();

/*
  The parse route makes the server fetch a url the user chose, and a page with
  structured job data costs no AI quota — so without its own cap it would let
  anyone use the server to hit other sites at will.
*/
const parseLimiter = rateLimit({
  windowSeconds: 10 * 60,
  max: 30,
  keyPrefix: "job-parse",
  identify: req => req.userId,
  message: "That's a lot of imports in a short time. Try again in a few minutes.",
});

router.use(validateAccessToken);

// Declared before "/:id" so it is not swallowed by the id param
router.get("/stats", jobApplicationController.getStats.bind(jobApplicationController));
router.post("/reminders/run", jobApplicationController.runReminders.bind(jobApplicationController));
router.post("/parse", parseLimiter, jobApplicationController.parseJob.bind(jobApplicationController));

router.get("/", jobApplicationController.getApplications.bind(jobApplicationController));
router.get("/:id", jobApplicationController.getApplicationById.bind(jobApplicationController));
router.post("/", jobApplicationController.createApplication.bind(jobApplicationController));
router.put("/:id", jobApplicationController.updateApplication.bind(jobApplicationController));
router.delete("/:id", jobApplicationController.deleteApplication.bind(jobApplicationController));

router.post("/:id/notes", jobApplicationController.linkNote.bind(jobApplicationController));
router.delete("/:id/notes/:noteId", jobApplicationController.unlinkNote.bind(jobApplicationController));

router.post("/:id/tailor", jobApplicationController.tailorResume.bind(jobApplicationController));
router.get("/:id/match", jobApplicationController.getMatch.bind(jobApplicationController));

router.post("/:id/recordings", jobApplicationController.linkRecording.bind(jobApplicationController));
router.delete("/:id/recordings/:recordingId", jobApplicationController.unlinkRecording.bind(jobApplicationController));

export { router as jobApplicationRouter };
