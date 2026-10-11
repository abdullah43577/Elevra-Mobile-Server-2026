import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const resumeController = new ResumeController();

router.use(validateAccessToken);

router.get("/templates", resumeController.getTemplates.bind(resumeController));
router.get("/templates/:id", resumeController.getTemplateById.bind(resumeController));

router.get("/", resumeController.getResumes.bind(resumeController));
router.get("/:id", resumeController.getResumeById.bind(resumeController));
router.post("/", resumeController.createResume.bind(resumeController));
router.put("/:id", resumeController.updateResume.bind(resumeController));
router.delete("/:id", resumeController.deleteResume.bind(resumeController));
router.post("/:id/duplicate", resumeController.duplicateResume.bind(resumeController));
router.post("/:id/export", resumeController.exportResume.bind(resumeController));

export { router as resumeRouter };
