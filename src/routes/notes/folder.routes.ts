import { Router } from "express";
import { FolderController } from "../../controllers/notes/folder.controller";
import { validateAccessToken } from "../../lib/validate-token";

const router = Router();
const folderController = new FolderController();

// All folder routes require authentication
router.use(validateAccessToken);

router.get("/", folderController.getFolders.bind(folderController));
router.get("/:id", folderController.getFolderById.bind(folderController));
router.post("/", folderController.createFolder.bind(folderController));
router.put("/:id", folderController.updateFolder.bind(folderController));
router.delete("/:id", folderController.deleteFolder.bind(folderController));

export { router as folderRouter };
