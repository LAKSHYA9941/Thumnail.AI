import express from "express";
import { register, login, googleAuth, getProfile } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/singleUserAuth";

const router = express.Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/google", googleAuth);
router.get("/auth/profile", authMiddleware, getProfile);

export default router;