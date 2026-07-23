import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validateAccessToken, validateRefreshToken } from "../lib/validate-token";
import { upload } from "../lib/multer-config";

const router = Router();
const authController = new AuthController();

router.get("/", authController.testApi.bind(authController));
router.post("/signup", authController.createUser.bind(authController));
router.post("/verify-email", authController.verifyEmail.bind(authController));
router.post("/resend-verification-otp", authController.resendVerificationOtp.bind(authController));
router.post("/signin", authController.loginUser.bind(authController));
router.post("/forgot-password", authController.forgotPassword.bind(authController));
router.get("/profile", validateAccessToken, authController.getProfile.bind(authController));
router.patch("/profile", validateAccessToken, upload.single("profile_pic"), authController.updateProfile.bind(authController));
router.post("/profile/settings", validateAccessToken, authController.updateProfileSettings.bind(authController));
router.post("/token", validateRefreshToken, authController.generateNewToken.bind(authController));

export { router as authRouter };
