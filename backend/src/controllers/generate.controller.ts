// src/controllers/generate.controller.ts
import dotenv from "dotenv";
dotenv.config();

import { Request, Response } from "express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { Thumbnail } from "../models/thumbnail.model.js";
import { AuthRequest } from "../middlewares/singleUserAuth.js";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* --------------------------
   Cloudinary config
--------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ Cloudinary configuration missing. Please check your environment variables.');
}

/* --------------------------
   OpenRouter client (for query rewriting only)
--------------------------- */
const openai = new (await import("openai")).default({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/* --------------------------
   Google Gemini client (for image generation)
--------------------------- */
let genAI: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Validate API configurations
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️ OpenRouter API key missing. Query rewriting will use fallback.');
}
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Gemini API key missing. Please check your environment variables.');
}

/* --------------------------
   1.  REWRITE PROMPT
--------------------------- */
export async function rewriteQuery(req: Request, res: Response) {
  try {
    const { prompt } = req.body;
    const uploadedFile = req.file; // Get the uploaded file from multer

    console.log('Rewrite query called with:', { prompt, hasFile: !!uploadedFile });

    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    let originalImageUrl: string | undefined;

    // If a file was uploaded, upload it to Cloudinary first
    if (uploadedFile) {
      try {
        console.log('Uploading file to Cloudinary:', uploadedFile.filename);
        const uploadResult = await cloudinary.uploader.upload(uploadedFile.path, {
          folder: "reference-images",
          resource_type: "image",
        });
        originalImageUrl = uploadResult.secure_url;
        console.log('File uploaded to Cloudinary:', originalImageUrl);

        // Clean up the temporary file
        fs.unlinkSync(uploadedFile.path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Clean up the temporary file even if upload fails
        if (fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
        }
        return res.status(500).json({ error: "Failed to upload reference image" });
      }
    }

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn("⚠️ OpenRouter API key not found, using fallback enhancement");
      const fallbackEnhanced = `Enhanced YouTube Thumbnail: ${prompt} - High quality, eye-catching design with bold text and vibrant colors`;
      return res.json({
        originalPrompt: prompt,
        rewrittenPrompt: fallbackEnhanced,
        note: "Using fallback enhancement due to missing API configuration"
      });
    }

    const userContent = originalImageUrl
      ? `Rewrite: ${prompt}\n\n(The user has uploaded a reference image; please enhance the prompt so it reflects the style, subject, and mood of that image.)`
      : `Rewrite: ${prompt}`;

    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "qwen/qwen-2.5-72b-instruct:free",
        temperature: 1,
        messages: [
          { role: "system", content: "you are a prompt engineer that helps to create the best possible prompts for text to image AI models so that user can get the best possible results for their youtube video. Use the techniques of modern thumbnail makers." },
          { role: "user", content: userContent },
        ],
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://thumnail-ai.vercel.app",
          "X-Title": "ThumbnailAI",
        },
      }
    );
    const rewritten = data.choices[0]?.message?.content?.trim() || prompt;
    res.json({ originalPrompt: prompt, rewrittenPrompt: rewritten });
  } catch (err: any) {
    console.error("Rewrite error:", err.response?.data || err.message || err);

  }
}

/* ----------------------------------------------------------
   2.  GENERATE THUMBNAILS → Cloudinary
----------------------------------------------------------- */
export async function generateImages(req: AuthRequest, res: Response) {
  try {
    const { prompt, queryRewrite } = req.body;
    const userId = req.user?.userId;
    const uploadedFile = req.file; // Get the uploaded file from multer

    console.log('Generate images called with:', { prompt, queryRewrite, userId, hasFile: !!uploadedFile });

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const finalPrompt = queryRewrite || prompt;
    let originalImageUrl: string | undefined;

    // If a file was uploaded, upload it to Cloudinary first
    if (uploadedFile) {
      try {
        console.log('Uploading file to Cloudinary:', uploadedFile.filename);
        const uploadResult = await cloudinary.uploader.upload(uploadedFile.path, {
          folder: "reference-images",
          resource_type: "image",
        });
        originalImageUrl = uploadResult.secure_url;
        console.log('File uploaded to Cloudinary:', originalImageUrl);

        // Clean up the temporary file
        fs.unlinkSync(uploadedFile.path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Clean up the temporary file even if upload fails
        if (fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
        }
        return res.status(500).json({ error: "Failed to upload reference image" });
      }
    }

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY || !genAI) {
      console.error("❌ Gemini API key is required for image generation");
      return res.status(500).json({
        error: "AI service configuration missing",
        details: "Gemini API key is required for image generation. Please check your environment variables."
      });
    }

    /* 1️⃣  Generate image using Google Gemini API */
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

    const systemPrompt = `You are an expert at making YouTube thumbnails. Focus on clear, impactful imagery and strong visuals. Consider the following when generating:
- Catchy: it should grab attention quickly
- Relevance: it should accurately represent the video content
- Text: best in class title for the video it should be legible, short, and punchy (Max 3-4 words)
- Text used should be 3D Glowing, sparkly making an impact at the audience colors related to the theme
- Composition: Use the best techniques there are for composition
- Color: Contrasting vibrant colors like it should set up the vibe of the video idea
- Emotion/Intrigue: it should evoke curiosity or a strong emotion
- Background Style: The background should be giving thumbnail a dramatic, intense, and user desired feeling. 
FOR EXAMPLE: Maintain visual tension with warm tones (reds/oranges/yellows) for urgency or cool tones (blues/greens) for calm topics. 

Cropping Instructions:
All generated images must be cropped to a strict 16:9 aspect ratio, suitable for YouTube thumbnails. The resolution should be at least 1280x720 pixels and content should be within the canvas no content item should be out of the frame and no blank spaces.

REQUIREMENTS:
- Follow the Rule of Thirds — place faces near the intersections to draw attention.
- Keep faces large and expressive (thumbnails with visible emotions get more clicks).
- Avoid leaving too much empty space — fill the frame with meaningful elements.
- Maintain visual tension with warm tones (reds/oranges/yellows) for urgency or cool tones (blues/greens) for calm topics. 
- It should be landscape-oriented, which is ideal for video thumbnails.
- Number of objects should be minimum, the prominent one should be the object in the image uploaded by the user.
- The object should be in the center,left and right of the image as specified by the user if not specified then it should be in the left.
- Generated object other than the prominent one should be placed well anywhere visible in the image.
- Keep the background slightly blurred or darkened so the main subjects pop.
- Additional Elements can be there FOR EXAMPLE:- a group of small crowd figures placed near the bottom center, behind a building.
- Generate exactly 1280x720 pixels (16:9 ratio)
- NEVER crop elements - fit everything within canvas
- Keep It Short & Punchy aim for 3-6 words max.
- the Frame should be filled with content props anything but it should look contentfull.
- Exaggerate on every element to make it look more impactful
- ALWAYS USE THE REFERENCE IMAGE IF IT IS PROVIDED AND ENHANCE SO THAT THE USER GET THE BEST VERSION OF HIM/HERSELF`;

    let parts: any[] = [
      { text: `${systemPrompt}\n\nGenerate a YouTube thumbnail for: ${finalPrompt}` }
    ];

    // Add reference image if provided
    if (originalImageUrl) {
      try {
        const imageResponse = await axios.get(originalImageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);
        const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

        parts.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType
          }
        });
      } catch (imageError) {
        console.warn('Failed to fetch reference image:', imageError);
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;

    // Extract generated images from the response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return res.status(500).json({ error: "No image generated" });
    }

    const base64s: string[] = [];
    for (const candidate of candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            base64s.push(`data:${mimeType};base64,${part.inlineData.data}`);
          }
        }
      }
    }

    if (!base64s.length) {
      return res.status(500).json({ error: "No image data received from Gemini" });
    }

    /* 3️⃣  Upload each to Cloudinary (resize on-the-fly) */
    /* 3️⃣  Upload each to Cloudinary (perfect YT thumbnail with smart crop) */
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
          transformation: [
            {
              width: 1280,
              height: 720,
              crop: "pad",        // keep entire image inside, no cropping
              background: "auto", // fill empty space with color matching edges
              quality: "auto",
              fetch_format: "auto"
            },
          ],
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

    // Check if it's a Gemini API error
    if (err.message && err.message.includes('API_KEY')) {
      console.error("❌ Gemini API key is invalid or expired");
      return res.status(500).json({
        error: "AI service authentication failed. Please check your API configuration.",
        details: "The Gemini API key appears to be invalid or expired."
      });
    }

    if (err.message && err.message.includes('QUOTA_EXCEEDED')) {
      console.error("❌ Gemini API quota exceeded");
      return res.status(500).json({
        error: "AI service quota exceeded",
        details: "The Gemini API quota has been exceeded. Please try again later or check your billing."
      });
    }

    // Check if it's a Cloudinary error
    if (err.message && err.message.includes('c_fill_pad')) {
      console.error("❌ Cloudinary transformation error:", err.message);
      return res.status(500).json({
        error: "Image processing failed",
        details: "There was an issue processing the generated image."
      });
    }

    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Image generation failed" });
    }
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