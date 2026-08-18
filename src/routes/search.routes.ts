import { Router } from "express";
import { SearchController } from "../controllers/search.controller";
import { validateAccessToken } from "../lib/validate-token";

const router = Router();
const searchController = new SearchController();

router.use(validateAccessToken);

router.get("/", searchController.search.bind(searchController));

export { router as searchRouter };
