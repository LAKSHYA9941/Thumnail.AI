import express, { Router } from "express";
import { 
  generateImages, 
  rewriteQuery, 
  getUserThumbnails, 
  deleteThumbnail,
  editImage
} from "../controllers/generate.controller.js";
import { authMiddleware } from "../middlewares/singleUserAuth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: Router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Test endpoint to check if basic functionality works
router.get("/generate/test", (req, res) => {
  res.json({ 
    message: "Generate routes working", 
    timestamp: new Date().toISOString(),
    hasMulter: !!upload,
    env: {
      hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
      hasMongo: !!process.env.MONGO_URI
    }
  });
});

// Simple rewrite endpoint without file upload for testing
router.post("/generate/rewrite-simple", (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }
    res.json({ 
      originalPrompt: prompt, 
      rewrittenPrompt: `Enhanced: ${prompt}`,
      message: "Simple rewrite working"
    });
  } catch (error) {
    console.error("Simple rewrite error:", error);
    res.status(500).json({ error: "Simple rewrite failed" });
  }
});

// Public routes - Add multer middleware for file uploads
router.post("/generate/rewrite-query", upload.single('referenceImage'), handleMulterError, rewriteQuery);

// Protected routes - Add multer middleware for file uploads
router.post("/generate/images", authMiddleware, upload.single('referenceImage'), handleMulterError, generateImages);
router.post("/generate/edit", authMiddleware, editImage);
router.get("/generate/thumbnails", authMiddleware, getUserThumbnails);
router.delete("/generate/thumbnails/:thumbnailId", authMiddleware, deleteThumbnail);

export default router;
