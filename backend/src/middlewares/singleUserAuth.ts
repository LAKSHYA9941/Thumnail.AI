import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

interface JwtPayload {
  userId: string;
  email: string;
}

// ✅ define and export AuthRequest
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = new User({ email, password, name });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id, email }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user: { email, name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register user" });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.json({ token, user: { email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to login" });
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded; // attach user info to req
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
