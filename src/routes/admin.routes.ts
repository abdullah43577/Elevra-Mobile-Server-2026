import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { validateAccessToken } from "../lib/validate-token";
import { validateAdminSession } from "../lib/validate-admin";

const router = Router();
const adminController = new AdminController();

router.use(validateAccessToken, validateAdminSession);

router.get("/stats", adminController.getStats.bind(adminController));
router.get("/users", adminController.getUsers.bind(adminController));
router.get("/users/:id", adminController.getUser.bind(adminController));
router.patch("/users/:id/status", adminController.updateUserStatus.bind(adminController));
router.patch("/users/:id/tier", adminController.updateUserTier.bind(adminController));
router.delete("/users/:id", adminController.deleteUser.bind(adminController));

export { router as adminRouter };
