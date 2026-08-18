import { Router } from "express";
import { CoverLetterController } from "../controllers/cover-letter.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const coverLetterController = new CoverLetterController();

router.use(validateAccessToken);

router.get("/", coverLetterController.getCoverLetters.bind(coverLetterController));
router.get("/:id", coverLetterController.getCoverLetterById.bind(coverLetterController));
router.post("/", coverLetterController.createCoverLetter.bind(coverLetterController));
router.put("/:id", coverLetterController.updateCoverLetter.bind(coverLetterController));
router.delete("/:id", coverLetterController.deleteCoverLetter.bind(coverLetterController));
router.post("/:id/export", coverLetterController.exportCoverLetter.bind(coverLetterController));

export { router as coverLetterRouter };
