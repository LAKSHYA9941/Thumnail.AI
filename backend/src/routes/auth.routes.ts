import express from "express";

import { registerUser, loginUser, authMiddleware } from "../middlewares/singleUserAuth.js"; // ✅ new imports
import { googleAuth, getProfile } from "../controllers/auth.controller.js"; // keep google auth + profile

const router = express.Router();

// ✅ use new register + login
router.post("/auth/register", registerUser);
router.post("/auth/login", loginUser);

router.post("/auth/google", googleAuth);
router.get("/auth/profile", authMiddleware, getProfile);

export default router;
