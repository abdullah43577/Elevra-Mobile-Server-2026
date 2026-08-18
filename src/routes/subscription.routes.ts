import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const subscriptionController = new SubscriptionController();

router.use(validateAccessToken);

router.get("/", subscriptionController.getSubscription.bind(subscriptionController));

/*
  Called by the client straight after a purchase or a restore. It carries no
  body on purpose: the client asks us to go and look, it never tells us what it
  bought.
*/
router.post("/sync", subscriptionController.syncSubscription.bind(subscriptionController));

export { router as subscriptionRouter };
