/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limits to support base64 uploading of large photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI feature won't work.");
}

// REST API endpoint for smart image analysis/enrichment
app.post("/api/gemini/analyze", async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      status: "error",
      message: "AI Service is not configured. Please ensure GEMINI_API_KEY is defined in Settings.",
    });
  }

  try {
    const { imageBase64, mimeType, metaTitle, metaTags, requestType } = req.body;

    let contents: any[] = [];
    let systemInstruction = "You are a professional Android Photo Gallery AI companion. Give high-impact creative results.";

    // Determine prompt based on requestType
    let prompt = "";
    if (requestType === "story") {
      prompt = "Write a captivating, creative 2-paragraph short story inspired by this photo. Make it rich, elegant, and poetic.";
    } else if (requestType === "gallery-summary") {
      prompt = `Act as an expert photography curator. I will provide you with the metadata (titles, locations, tags) of my photo gallery. Write a creative 2-paragraph summary characterizing my photography style, the common themes, and what makes my collection unique.`;
    } else {
      prompt = "Analyze this image and provide a highly descriptive caption (2-3 sentences) explaining the visual elements, mood, and aesthetic. Also suggest 5 highly relevant visual terms or tags.";
    }

    if (metaTitle || metaTags) {
      if (requestType === "gallery-summary") {
        prompt += ` Gallery Metadata: ${JSON.stringify(req.body.galleryData)}`;
      } else {
        prompt += ` Contextual context: Title: "${metaTitle || 'Unknown'}", Tags: ${(metaTags || []).join(", ")}.`;
      }
    }

    if (imageBase64) {
      // Clean base64 header if present
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents = [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: cleanBase64,
          },
        },
        { text: prompt },
      ];
    } else {
      contents = [prompt];
    }

    // Set up structured JSON response schema for tag generation
    if (requestType !== "story" && requestType !== "gallery-summary") {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: "A gorgeous aesthetic description of the photo's elements, mood, and color palette.",
              },
              suggestedTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of exactly 5 precise tags/keywords describing the image elements.",
              },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of exactly 5 dominant hex color codes from the image (e.g. #FF5B22, #000000).",
              },
              suggestedAlbum: {
                type: Type.STRING,
                description: "A short, fitting album or category name for this image (e.g. 'Nature', 'Travel', 'Portraits'). Keep it 1-2 words max.",
              },
            },
            required: ["description", "suggestedTags", "palette", "suggestedAlbum"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No output generated from Gemini model.");
      }

      const parsed = JSON.parse(responseText.trim());
      return res.json({
        status: "success",
        ...parsed,
      });
    } else {
      // Narrative story mode
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: { systemInstruction },
      });

      return res.json({
        status: "success",
        story: response.text || "No narrative generated.",
      });
    }
  } catch (error: any) {
    console.error("Gemini analysis failed:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "An error occurred while contacting Gemini API.",
    });
  }
});

// Configure Vite middleware for development vs static asset delivery for production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated successfully.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA catch-all routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to bootstrap Vite Server:", err);
});
