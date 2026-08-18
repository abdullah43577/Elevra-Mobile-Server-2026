import { Router } from "express";
import { CareerProfileController } from "../controllers/career-profile.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const careerProfileController = new CareerProfileController();

router.use(validateAccessToken);

router.get("/", careerProfileController.getProfile.bind(careerProfileController));
router.put("/", careerProfileController.saveProfile.bind(careerProfileController));
router.delete("/", careerProfileController.deleteProfile.bind(careerProfileController));

export { router as careerProfileRouter };
