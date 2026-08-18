import { Router } from "express";
import { InterviewPrepController } from "../controllers/interview-prep.controller";
import { upload } from "../lib/multer-config";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const prepController = new InterviewPrepController();

router.use(validateAccessToken);

// Static paths first — /stats and /practice would otherwise be swallowed by /:id
router.get("/stats", prepController.getStats.bind(prepController));
router.post("/practice", prepController.recordPractice.bind(prepController));

router.get("/", prepController.getQuestions.bind(prepController));
router.post("/", prepController.createQuestion.bind(prepController));
router.get("/:id", prepController.getQuestionById.bind(prepController));
router.put("/:id", prepController.updateQuestion.bind(prepController));
router.delete("/:id", prepController.deleteQuestion.bind(prepController));

router.put("/:id/answer", prepController.saveAnswer.bind(prepController));
router.post("/:id/answer/audio", upload.single("audio"), prepController.uploadAnswerAudio.bind(prepController));
router.delete("/:id/answer/audio", prepController.deleteAnswerAudio.bind(prepController));

router.post("/:id/applications/:applicationId", prepController.linkToApplication.bind(prepController));
router.delete("/:id/applications/:applicationId", prepController.unlinkFromApplication.bind(prepController));

export { router as interviewPrepRouter };
