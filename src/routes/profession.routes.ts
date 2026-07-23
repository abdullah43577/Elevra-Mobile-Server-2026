import { Router } from "express";
import { ProfessionController } from "../controllers/profession.controller";

const router = Router();
const professionController = new ProfessionController();

router.get("/", professionController.list.bind(professionController));

export { router as professionRouter };
