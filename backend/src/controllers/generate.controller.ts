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
   OpenRouter client
--------------------------- */
const openai = new (await import("openai")).default({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Validate OpenRouter configuration
if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ OpenRouter API key missing. Please check your environment variables.');
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

    const system = originalImageUrl
      ? "Enhance the prompt for a YouTube thumbnail. Use the uploaded image as reference."
      : "Enhance the prompt for a YouTube thumbnail.";

    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: originalImageUrl
              ? [
                { type: "text", text: `Rewrite: ${prompt}` },
                { type: "image_url", image_url: { url: originalImageUrl } }
              ]
              : `Rewrite: ${prompt}`
          },
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
    console.error("Rewrite error:", err);

    // Check if it's an OpenRouter API error
    if (err.response?.status === 401) {
      console.error("❌ OpenRouter API key is invalid or expired");
      return res.status(500).json({
        error: "AI service authentication failed. Please check your API configuration.",
        details: "The OpenRouter API key appears to be invalid or expired."
      });
    }

    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to rewrite prompt" });
    }
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

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("❌ OpenRouter API key is required for image generation");
      return res.status(500).json({
        error: "AI service configuration missing",
        details: "OpenRouter API key is required for image generation. Please check your environment variables."
      });
    }

    /* 1️⃣  Ask Gemini for image(s) */
    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages: [
          {
            role: "user",
            system:
`You are an AI trained to generate high-quality YouTube thumbnails. Your output should always be a visually striking image optimized for maximum click-through rate on YouTube. Focus on clear, impactful imagery, concise text (if requested), and strong visual hierarchy. Consider the following when generating:
Clarity: Is the main subject immediately recognizable?
Impact: Does it grab attention quickly?
Relevance: Does it accurately represent the video content?
Text (Optional): If text is included, is it legible, short, and punchy? (Max 5-7 words)
Composition: Use the rule of thirds or other strong compositional techniques.
Color: Employ vibrant, contrasting colors to stand out.
Emotion/Intrigue: Does it evoke curiosity or a strong emotion?
Cropping Instructions:
"All generated images must be cropped to a strict 16:9 aspect ratio, suitable for YouTube thumbnails. The resolution should be at least 1280x720 pixels, ideally 1920x1080 pixels for optimal quality."
How to use this:
When you're describing the thumbnail you want, imagine these instructions are always active in the background. For example:
User Request: "Generate a YouTube thumbnail for a video about the best gaming setups of 2024. I want a futuristic desk, a high-end PC, and some bright RGB lighting. Maybe a subtle 'BEST SETUPS' text."
AI's Internal Process (influenced by prompt):
Clarity: The desk and PC should be the stars.
Impact: Make the RGB lighting pop.
Text: "BEST SETUPS" is short and relevant.
Composition: Maybe have the desk and PC angled slightly to create dynamism.
Color: Use electric blues, purples, and greens for RGB.
AI Output (Example of what the AI generates internally based on your prompt, then it will send it to the image generator)`,
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
          "HTTP-Referer": "https://thumnail-ai.vercel.app",
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

    // Check if it's an OpenRouter API error
    if (err.response?.status === 401) {
      console.error("❌ OpenRouter API key is invalid or expired");
      return res.status(500).json({
        error: "AI service authentication failed. Please check your API configuration.",
        details: "The OpenRouter API key appears to be invalid or expired."
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





/* 



Video game

Cooking

Health and fitness

Personal finance

Travel

Education

Beauty and fashion

Digital marketing

Fashion

Tech reviews

Automotive

Finance and investing

Pet

Technology and gadgets

Tutorials

Lifestyle

Arts and Crafts

Comedy

Home Improvement

Online teaching

Passive income

Makeup

Product reviews


System Prompt:
"You are an AI trained to generate high-quality YouTube thumbnails. Your output should always be a visually striking image optimized for maximum click-through rate on YouTube. Focus on clear, impactful imagery, concise text (if requested), and strong visual hierarchy. Consider the following when generating:
Clarity: Is the main subject immediately recognizable?
Impact: Does it grab attention quickly?
Relevance: Does it accurately represent the video content?
Text (Optional): If text is included, is it legible, short, and punchy? (Max 5-7 words)
Composition: Use the rule of thirds or other strong compositional techniques.
Color: Employ vibrant, contrasting colors to stand out.
Emotion/Intrigue: Does it evoke curiosity or a strong emotion?
Cropping Instructions:
"All generated images must be cropped to a strict 16:9 aspect ratio, suitable for YouTube thumbnails. The resolution should be at least 1280x720 pixels, ideally 1920x1080 pixels for optimal quality."
How to use this:
When you're describing the thumbnail you want, imagine these instructions are always active in the background. For example:
User Request: "Generate a YouTube thumbnail for a video about the best gaming setups of 2024. I want a futuristic desk, a high-end PC, and some bright RGB lighting. Maybe a subtle 'BEST SETUPS' text."
AI's Internal Process (influenced by prompt):
Clarity: The desk and PC should be the stars.
Impact: Make the RGB lighting pop.
Text: "BEST SETUPS" is short and relevant.
Composition: Maybe have the desk and PC angled slightly to create dynamism.
Color: Use electric blues, purples, and greens for RGB.
AI Output (Example of what the AI generates internally based on your prompt, then it will send it to the image generator):


 */