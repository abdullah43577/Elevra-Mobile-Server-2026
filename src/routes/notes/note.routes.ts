import { Router } from "express";
import { NoteController } from "../../controllers/notes/note.controller";
import { validateAccessToken } from "../../lib/validate-token";

const router = Router();
const noteController = new NoteController();

// All note routes require authentication
router.use(validateAccessToken);

router.get("/", noteController.getNotes.bind(noteController));
router.get("/archived", noteController.getArchivedNotes.bind(noteController));
router.get("/:id", noteController.getNoteById.bind(noteController));
router.post("/", noteController.createNote.bind(noteController));
router.put("/:id", noteController.updateNote.bind(noteController));
router.delete("/:id", noteController.deleteNote.bind(noteController));
router.post("/:id/archive", noteController.toggleArchive.bind(noteController));
router.post("/:id/pin", noteController.togglePin.bind(noteController));
router.post("/:id/summary", noteController.generateSummary.bind(noteController));

export { router as noteRouter };
