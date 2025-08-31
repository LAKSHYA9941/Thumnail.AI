import dotenv from "dotenv";
dotenv.config();

import { Request, Response } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import mime from "mime";
import { Thumbnail } from "../models/thumbnail.model.js";
import { AuthRequest } from "../middlewares/singleUserAuth.js";
import { fileURLToPath } from "url";
import axios from "axios";
import sharp from "sharp";
import fsp from "fs/promises";
import { v2 as cloudinary } from "cloudinary";


// Check if API key is configured
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.warn("⚠️  OPENROUTER_API_KEY not found. Image generation will be limited.");
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY || "",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../../generated");
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

/* ----------------------------------------------------------
   1.  REWRITE PROMPT
----------------------------------------------------------- */
export async function rewriteQuery(req: Request, res: Response) {
  try {
    const { prompt, originalImage } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    if (!OPENROUTER_API_KEY) {
      // Return a simple enhancement for demo purposes
      const enhancedPrompt = `${prompt} - Enhanced with vibrant colors, professional design, and eye-catching elements for YouTube thumbnail`;
      return res.json({
        originalPrompt: prompt,
        rewrittenPrompt: enhancedPrompt,
        note: "Mock enhancement - add OPENROUTER_API_KEY to .env for AI-powered enhancement"
      });
    }

    let systemPrompt =
      "You are an expert at rewriting prompts for AI image generation. Your task is to enhance the user's prompt to create better, more detailed, and more engaging YouTube thumbnails. Make the prompt more specific, add relevant details, and ensure it follows best practices for thumbnail design.";

    if (originalImage) {
      systemPrompt +=
        " The user has uploaded a reference image. Always use this image's content as inspiration and reference when rewriting the prompt.";
    }

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash-image-preview:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Rewrite this prompt: "${prompt}"` },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const rewritten = completion.choices[0]?.message?.content?.trim() || prompt;
    res.json({ originalPrompt: prompt, rewrittenPrompt: rewritten });
  } catch (err: any) {
    console.error("Query rewrite error:", err);
    res.status(500).json({ error: "Failed to rewrite query" });
  }
}

/* ----------------------------------------------------------
   2.  GENERATE THUMBNAIL IMAGES
----------------------------------------------------------- */





// ✅ Configure Cloudinary (make sure these are in your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function generateImages(req: AuthRequest, res: Response) {
  try {
    const { prompt, originalImageUrl, queryRewrite } = req.body;
    const userId = req.user?.userId;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: "API key not configured. Please set OPENROUTER_API_KEY in your environment variables.",
        urls: [],
      });
    }

    const finalPrompt = queryRewrite || prompt;

    /* 1️⃣ Call OpenRouter API */
    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages: [{ role: "user", content: finalPrompt }],
        modalities: ["image", "text"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "ThumbnailAI",
        },
      }
    );

    console.log("OpenRouter response:", JSON.stringify(data, null, 2));

    /* 2️⃣ Extract image URL or base64 */
    let imageUrl: string | null = null;

    if (data.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
      imageUrl = data.choices[0].message.images[0].image_url.url;
    } else if (
      data.choices?.[0]?.message?.content &&
      data.choices[0].message.content.includes("data:image")
    ) {
      const match = data.choices[0].message.content.match(
        /data:image\/(png|jpeg|jpg|gif);base64,[^"\s]+/
      );
      if (match) imageUrl = match[0];
    }

    if (!imageUrl) {
      console.error("No image URL found in response:", data);
      return res.status(500).json({ error: "No image received" });
    }

    /* 3️⃣ Download image into buffer */
    let imageBuffer: Buffer;

    if (imageUrl.startsWith("data:image")) {
      // base64 format
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      // remote URL
      const response = await axios({ method: "GET", url: imageUrl, responseType: "arraybuffer" });
      imageBuffer = Buffer.from(response.data);
    }

    /* 4️⃣ Resize in memory */
    const resizedBuffer = await sharp(imageBuffer)
      .resize(1280, 720, { fit: "inside" })
      .toFormat("png")
      .toBuffer();

    /* 5️⃣ Upload to Cloudinary */
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "thumbnails", // optional: Cloudinary folder
            resource_type: "image",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(resizedBuffer);
    });

    const cloudinaryUrl = uploadResult.secure_url;

    /* 6️⃣ Save metadata in DB */
    const thumbnail = new Thumbnail({
      userId,
      prompt: finalPrompt,
      imageUrl: cloudinaryUrl,
      originalImageUrl,
      queryRewrite: queryRewrite || undefined,
    });

    await thumbnail.save();

    res.json({ urls: [cloudinaryUrl] });
  } catch (error: any) {
    console.error("Image generation error:", error.response?.data || error.message);
    console.error("Full error:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
}


/* ----------------------------------------------------------
   3.  OTHER ENDPOINTS (unchanged)
----------------------------------------------------------- */
export async function getUserThumbnails(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    const thumbnails = await Thumbnail.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ thumbnails });
  } catch (err) {
    console.error("Get thumbnails error:", err);
    res.status(500).json({ error: "Failed to get thumbnails" });
  }
}

export async function deleteThumbnail(req: AuthRequest, res: Response) {
  try {
    const { thumbnailId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    const thumbnail = await Thumbnail.findOne({ _id: thumbnailId, userId });
    if (!thumbnail) return res.status(404).json({ error: "Thumbnail not found" });

    const imagePath = path.join(OUTPUT_DIR, thumbnail.imageUrl.split("/").pop()!);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await Thumbnail.deleteOne({ _id: thumbnailId });
    res.json({ message: "Thumbnail deleted successfully" });
  } catch (err) {
    console.error("Delete thumbnail error:", err);
    res.status(500).json({ error: "Failed to delete thumbnail" });
  }
}