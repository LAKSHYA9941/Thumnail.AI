import express from "express";
import { register, login, googleAuth, getProfile } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/singleUserAuth.js";

const router = express.Router();

// Auth routes
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/google", googleAuth);

// Protected profile route
router.get("/auth/profile", authMiddleware, getProfile);

export default router;