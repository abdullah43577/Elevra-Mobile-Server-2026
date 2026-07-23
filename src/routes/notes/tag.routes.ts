import { Router } from "express";
import { TagController } from "../../controllers/notes/tag.controller";
import { validateAccessToken } from "../../lib/validate-token";

const router = Router();
const tagController = new TagController();

// All tag routes require authentication
router.use(validateAccessToken);

router.get("/", tagController.getTags.bind(tagController));
router.get("/:id", tagController.getTagById.bind(tagController));
router.post("/", tagController.createTag.bind(tagController));
router.delete("/:id", tagController.deleteTag.bind(tagController));

export { router as tagRouter };
