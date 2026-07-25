import { Router } from "express";
import { validateAccessToken } from "../lib/validate-token";
import { VoiceRecordingController } from "../controllers/voice-recording.conroller";
import { upload } from "../lib/multer-config";

const router = Router();
const voiceController = new VoiceRecordingController();

// All voice recording routes require authentication
router.use(validateAccessToken);

router.get("/", voiceController.getRecordings.bind(voiceController));
router.get("/:id", voiceController.getRecordingById.bind(voiceController));
router.post("/", upload.single("audio"), voiceController.createRecording.bind(voiceController));
router.put("/:id", voiceController.updateRecording.bind(voiceController));
router.delete("/:id", voiceController.deleteRecording.bind(voiceController));
router.post("/:id/transcribe", voiceController.transcribeRecording.bind(voiceController));

export { router as voiceRecordingRouter };
