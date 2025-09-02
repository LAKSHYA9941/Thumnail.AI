import express, { Router } from "express";
import { 
  generateImages, 
  rewriteQuery, 
  getUserThumbnails, 
  deleteThumbnail 
} from "../controllers/generate.controller.js";
import { authMiddleware } from "../middlewares/singleUserAuth.js";

const router: Router = express.Router();

// Public routes - Add multer middleware for file uploads
router.post("/generate/rewrite-query", (req, res, next) => {
  // Get the upload middleware from app.locals
  const upload = req.app.locals.upload;
  upload.single('referenceImage')(req, res, next);
}, rewriteQuery);

// Protected routes - Add multer middleware for file uploads
router.post("/generate/images", authMiddleware, (req, res, next) => {
  // Get the upload middleware from app.locals
  const upload = req.app.locals.upload;
  upload.single('referenceImage')(req, res, next);
}, generateImages);
router.get("/generate/thumbnails", authMiddleware, getUserThumbnails);
router.delete("/generate/thumbnails/:thumbnailId", authMiddleware, deleteThumbnail);

export default router;
