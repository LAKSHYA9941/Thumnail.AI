import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { OAuth2Client } from "google-auth-library";
import { AuthRequest } from "../middlewares/singleUserAuth.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required",
        code: "VALIDATION_ERROR"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: "Please provide a valid email address",
        code: "INVALID_EMAIL"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS"
      });
    }

    const user = new User({
      email,
      password,
      name,
      isGoogleUser: false,
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
        code: "VALIDATION_ERROR"
      });
    }
    
    res.status(500).json({ 
      error: "Registration failed. Please try again later.",
      code: "INTERNAL_ERROR"
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required",
        code: "VALIDATION_ERROR"
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ 
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({ 
        error: "Account temporarily locked due to multiple failed login attempts",
        code: "ACCOUNT_LOCKED",
        lockUntil: user.lockUntil
      });
    }

    const isPasswordValid = await (user as any).comparePassword(password);
    if (!isPasswordValid) {
      await (user as any).handleFailedLogin();
      return res.status(401).json({ 
        error: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
        remainingAttempts: Math.max(0, 5 - (user.failedLoginAttempts || 0) - 1)
      });
    }

    // Reset failed attempts on successful login
    await (user as any).resetLoginAttempts();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      error: "Login failed. Please try again later.",
      code: "INTERNAL_ERROR"
    });
  }
}

export async function googleAuth(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ 
        error: "ID token is required",
        code: "VALIDATION_ERROR"
      });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ 
        error: "Invalid Google token",
        code: "INVALID_TOKEN"
      });
    }

    const { email, sub: googleId, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        googleId,
        name,
        avatar: picture,
        isGoogleUser: true,
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.name = name;
      user.avatar = picture;
      user.isGoogleUser = true;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ 
      error: "Google authentication failed. Please try again later.",
      code: "INTERNAL_ERROR"
    });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        error: "Not authenticated",
        code: "UNAUTHORIZED"
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isGoogleUser: user.isGoogleUser,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ 
      error: "Failed to get profile",
      code: "INTERNAL_ERROR"
    });
  }
}