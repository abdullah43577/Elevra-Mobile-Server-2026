import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const authController = new AuthController();

router.get("/", authController.testApi.bind(authController));
router.post("/signup", authController.createUser.bind(authController));
router.post("/verify-email", authController.verifyEmail.bind(authController));
router.post("/resend-verification-otp", authController.resendVerificationOtp.bind(authController));
router.post("/signin", authController.loginUser.bind(authController));
router.post("/forgot-password", authController.forgotPassword.bind(authController));
router.get("/profile", authController.getProfile.bind(authController));

export { router as authRouter };
