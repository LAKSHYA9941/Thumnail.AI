import express, { Router } from "express";
import { 
  generateImages, 
  rewriteQuery, 
  getUserThumbnails, 
  deleteThumbnail 
} from "../controllers/generate.controller.js";
import { authMiddleware } from "../middlewares/singleUserAuth.js";

const router: Router = express.Router();

// Public routes
router.post("/generate/rewrite-query", rewriteQuery);

// Protected routes
router.post("/generate/images", authMiddleware, generateImages);
router.get("/generate/thumbnails", authMiddleware, getUserThumbnails);
router.delete("/generate/thumbnails/:thumbnailId", authMiddleware, deleteThumbnail);

export default router;
