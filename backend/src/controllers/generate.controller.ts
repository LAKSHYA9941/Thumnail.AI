// src/controllers/generate.controller.ts
import dotenv from "dotenv";
dotenv.config();

import { Request, Response } from "express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { Thumbnail } from "../models/thumbnail.model.js";
import { AuthRequest } from "../middlewares/singleUserAuth.js";

/* --------------------------
   Cloudinary config
--------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* --------------------------
   OpenRouter client
--------------------------- */
const openai = new (await import("openai")).default({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/* --------------------------
   1.  REWRITE PROMPT
--------------------------- */
export async function rewriteQuery(req: Request, res: Response) {
  try {
    const { prompt, originalImage } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const system = originalImage
      ? "Enhance the prompt for a YouTube thumbnail. Use the uploaded image as reference."
      : "Enhance the prompt for a YouTube thumbnail.";
    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Rewrite: ${prompt}` },
        ],
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "ThumbnailAI",
        },
      }
    );
    const rewritten = data.choices[0]?.message?.content?.trim() || prompt;
    res.json({ originalPrompt: prompt, rewrittenPrompt: rewritten });
  } catch (err) {
    console.error("Rewrite error:", err);
    res.status(500).json({ error: "Failed to rewrite prompt" });
  }
}

/* ----------------------------------------------------------
   2.  GENERATE THUMBNAILS → Cloudinary
----------------------------------------------------------- */
export async function generateImages(req: AuthRequest, res: Response) {
  try {
    const { prompt, originalImageUrl, queryRewrite } = req.body;
    const userId = req.user?.userId;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const finalPrompt = queryRewrite || prompt;

    /* 1️⃣  Ask Gemini for image(s) */
    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: finalPrompt },
              ...(originalImageUrl
                ? [{ type: "image_url", image_url: { url: originalImageUrl } }]
                : []),
            ],
          },
        ],
        modalities: ["image", "text"],
        max_tokens: 4096,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "ThumbnailAI",
        },
      }
    );

    /* 2️⃣  Extract image(s) */
    const images = data.choices[0]?.message?.images || [];
    const base64Regex = /data:image\/(png|jpeg|jpg);base64,([^"\s]+)/gi;
    const base64s = [...(data.choices[0]?.message?.content?.match(base64Regex) || []), ...images.map((i: any) => i.image_url?.url)];
    if (!base64s.length) return res.status(500).json({ error: "No image received" });

    /* 3️⃣  Upload each to Cloudinary (resize on-the-fly) */
    const urls: string[] = [];
    for (const src of base64s) {
      let buffer: Buffer;
      if (src.startsWith("data:image")) {
        buffer = Buffer.from(src.split(",")[1], "base64");
      } else {
        const { data: arrBuff } = await axios.get(src, { responseType: "arraybuffer" });
        buffer = Buffer.from(arrBuff);
      }
      const uploadRes = await cloudinary.uploader.upload(
        `data:image/png;base64,${buffer.toString("base64")}`,
        {
          folder: "thumbnails",
          resource_type: "image",
          transformation: [{ width: 1280, height: 720, crop: "fill_pad" }],
        }
      );
      urls.push(uploadRes.secure_url);
      await new Thumbnail({
        userId,
        prompt: finalPrompt,
        imageUrl: uploadRes.secure_url,
        originalImageUrl,
        queryRewrite: queryRewrite || undefined,
      }).save();
    }

    res.json({ urls });
  } catch (err: any) {
    console.error("Image gen error:", err.response?.data || err.message);
    res.status(500).json({ error: "Image generation failed" });
  }
}

/* ----------------------------------------------------------
   3.  OTHER ENDPOINTS (unchanged)
----------------------------------------------------------- */
export async function getUserThumbnails(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const thumbs = await Thumbnail.find({ userId }).sort({ createdAt: -1 }).limit(50);
  res.json({ thumbnails: thumbs });
}

export async function deleteThumbnail(req: AuthRequest, res: Response) {
  const { thumbnailId } = req.params;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const thumb = await Thumbnail.findOne({ _id: thumbnailId, userId });
  if (!thumb) return res.status(404).json({ error: "Thumbnail not found" });

  // Optional: delete from Cloudinary too
  const publicId = thumb.imageUrl.split("/").pop()?.split(".")[0];
  if (publicId) await cloudinary.uploader.destroy(`thumbnails/${publicId}`);

  await Thumbnail.deleteOne({ _id: thumbnailId });
  res.json({ message: "Thumbnail deleted" });
}