// src/controllers/generate.controller.ts
import dotenv from "dotenv";
dotenv.config();

import { Request, Response } from "express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { Thumbnail } from "../models/thumbnail.model.js";
import { AuthRequest } from "../middlewares/singleUserAuth.js";
import fs from "fs";

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
   Replicate configuration
--------------------------- */
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_VERSION = process.env.REPLICATE_FLUX_SCHNELL_VERSION || "c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e";
const REPLICATE_POLL_INTERVAL = Number(process.env.REPLICATE_POLL_INTERVAL_MS || 2000);
const REPLICATE_TIMEOUT = Number(process.env.REPLICATE_TIMEOUT_MS || 120000);

// Validate API configurations
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️ OpenRouter API key missing. Query rewriting will use fallback.');
}
if (!REPLICATE_API_TOKEN) {
  console.error('❌ Replicate API token missing. Image generation will fail.');
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
          { role: "system", content: "you are a prompt engineer that helps to create the best possible prompts with clarifying the user's prompt and segregate his her requirement like title name image description number of objects , their palcements , their name, for better results for text to image AI models so that user can get the best possible results for their youtube video. Use the techniques of modern thumbnail makers." },
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

    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({
        error: "AI service configuration missing",
        details: "Replicate API token is required for image generation. Please check your environment variables."
      });
    }

    const systemPrompt = `You are an expert at making YouTube thumbnails. Focus on clear, impactful imagery and strong visuals. Consider the following when generating:
- Catchy: it should grab attention quickly
- Relevance: it should accurately represent the video content
- Emotion/Intrigue: it should evoke curiosity or a strong emotion
- Background Style: The background should be giving thumbnail a dramatic, intense, and user desired feeling.
- Follow the Rule of Thirds — place faces near the intersections to draw attention.
- ALWAYS USE THE REFERENCE IMAGE IF IT IS PROVIDED AND ENHANCE SO THAT THE USER GET THE BEST VERSION OF HIM/HERSELF`;

    const payload: any = {
      version: REPLICATE_VERSION,
      input: {
        prompt: `${systemPrompt}\n\nGenerate a YouTube thumbnail for: ${finalPrompt}`,
        aspect_ratio: "16:9",
        output_format: "png",
        output_quality: 100,
        num_outputs: 1,
        num_inference_steps: 4,
        go_fast: true,
      },
    };

    if (originalImageUrl) {
      payload.input.image = originalImageUrl;
    }

    const replicateHeaders = {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    const startTime = Date.now();
    const prediction = await axios.post(
      "https://api.replicate.com/v1/predictions",
      payload,
      { headers: replicateHeaders }
    );

    const predictionId = prediction.data.id;
    let predictionStatus = prediction.data.status;
    let predictionOutput: string[] | undefined;
    let predictionError: string | undefined;

    while (predictionStatus === "starting" || predictionStatus === "processing") {
      if (Date.now() - startTime > REPLICATE_TIMEOUT) {
        await axios.post(
          `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
          {},
          { headers: replicateHeaders }
        ).catch(() => {});
        return res.status(504).json({
          error: "Image generation timed out",
          details: "Replicate prediction exceeded the configured timeout",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, REPLICATE_POLL_INTERVAL));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: replicateHeaders }
      );

      predictionStatus = poll.data.status;
      predictionOutput = poll.data.output;
      predictionError = poll.data.error;
    }

    if (predictionStatus !== "succeeded" || !predictionOutput?.length) {
      console.error("Replicate generation failed", predictionError || predictionStatus);
      return res.status(500).json({
        error: "Image generation failed",
        details: predictionError || `Replicate status: ${predictionStatus}`,
      });
    }

    const base64s: string[] = [];
    for (const outputUrl of predictionOutput) {
      try {
        const { data: imgData } = await axios.get(outputUrl, { responseType: "arraybuffer" });
        base64s.push(`data:image/png;base64,${Buffer.from(imgData).toString("base64")}`);
      } catch (downloadErr) {
        console.warn("Failed to download Replicate output", downloadErr);
      }
    }

    if (!base64s.length) {
      return res.status(500).json({ error: "No image data received from Replicate" });
    }

    /* 3️⃣  Upload each to Cloudinary (perfect YT thumbnail with smart crop) */
    const urls: string[] = [];
    for (const src of base64s) {
      const buffer = Buffer.from(src.split(",")[1], "base64");
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

    if (err.response?.data) {
      console.error("Replicate API error:", err.response.data);
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

export async function editImage(req: AuthRequest, res: Response) {
  try {
    const { thumbnailId, editPrompt } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!thumbnailId || !editPrompt) {
      return res.status(400).json({ error: "Thumbnail ID and edit prompt are required" });
    }

    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({
        error: "AI service configuration missing",
        details: "Replicate API token is required for image editing. Please check your environment variables."
      });
    }

    const existingThumbnail = await Thumbnail.findOne({ _id: thumbnailId, userId });
    if (!existingThumbnail) {
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    const systemPrompt = `You are an expert at enhancing existing YouTube thumbnails. When modifying the provided image, preserve the overall composition while applying the requested changes. Keep the output at 1280x720 (16:9) and ensure the result remains bold, clear, and attention-grabbing.`;

    const combinedPrompt = `${existingThumbnail.prompt}\nRequested changes: ${editPrompt}`;

    let base64Image: string | undefined;
    try {
      const originalResponse = await axios.get(existingThumbnail.imageUrl, { responseType: "arraybuffer" });
      base64Image = `data:image/png;base64,${Buffer.from(originalResponse.data).toString("base64")}`;
    } catch (downloadError) {
      console.error("Failed to download original image for editing", downloadError);
      return res.status(500).json({ error: "Unable to fetch original image for editing." });
    }

    const payload: any = {
      version: REPLICATE_VERSION,
      input: {
        prompt: `${systemPrompt}\n\nOriginal thumbnail context: ${existingThumbnail.prompt}\n\nApply the following updates: ${editPrompt}`,
        aspect_ratio: "16:9",
        output_format: "png",
        output_quality: 100,
        num_outputs: 1,
        num_inference_steps: 10,
        guidance: 7,
        image: base64Image,
      },
    };

    const replicateHeaders = {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    const startTime = Date.now();
    const prediction = await axios.post(
      "https://api.replicate.com/v1/predictions",
      payload,
      { headers: replicateHeaders }
    );

    const predictionId = prediction.data.id;
    let predictionStatus = prediction.data.status;
    let predictionOutput: string[] | undefined;
    let predictionError: string | undefined;

    while (predictionStatus === "starting" || predictionStatus === "processing") {
      if (Date.now() - startTime > REPLICATE_TIMEOUT) {
        await axios.post(
          `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
          {},
          { headers: replicateHeaders }
        ).catch(() => {});
        return res.status(504).json({
          error: "Image editing timed out",
          details: "Replicate prediction exceeded the configured timeout",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, REPLICATE_POLL_INTERVAL));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: replicateHeaders }
      );

      predictionStatus = poll.data.status;
      predictionOutput = poll.data.output;
      predictionError = poll.data.error;
    }

    if (predictionStatus !== "succeeded" || !predictionOutput?.length) {
      console.error("Replicate edit failed", predictionError || predictionStatus);
      return res.status(500).json({
        error: "Image editing failed",
        details: predictionError || `Replicate status: ${predictionStatus}`,
      });
    }

    const base64s: string[] = [];
    for (const outputUrl of predictionOutput) {
      try {
        const { data: imgData } = await axios.get(outputUrl, { responseType: "arraybuffer" });
        base64s.push(`data:image/png;base64,${Buffer.from(imgData).toString("base64")}`);
      } catch (downloadErr) {
        console.warn("Failed to download Replicate edit output", downloadErr);
      }
    }

    if (!base64s.length) {
      return res.status(500).json({ error: "No image data received from Replicate" });
    }

    const urls: string[] = [];
    for (const src of base64s) {
      const buffer = Buffer.from(src.split(",")[1], "base64");
      const uploadRes = await cloudinary.uploader.upload(
        `data:image/png;base64,${buffer.toString("base64")}`,
        {
          folder: "thumbnails",
          resource_type: "image",
          transformation: [
            {
              width: 1280,
              height: 720,
              crop: "pad",
              background: "auto",
              quality: "auto",
              fetch_format: "auto"
            },
          ],
        }
      );

      urls.push(uploadRes.secure_url);
      await new Thumbnail({
        userId,
        prompt: combinedPrompt,
        imageUrl: uploadRes.secure_url,
        originalImageUrl: existingThumbnail.imageUrl,
        queryRewrite: existingThumbnail.queryRewrite,
      }).save();
    }

    res.json({ urls });
  } catch (err: any) {
    console.error("Image edit error:", err.response?.data || err.message);

    if (err.response?.data) {
      console.error("Replicate API error:", err.response.data);
    }

    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Image editing failed" });
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