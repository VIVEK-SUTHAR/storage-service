import { GoogleGenAI } from "@google/genai";
import { handleRetrieveHash } from "./handlers";
import { hash, redis, serve } from "bun";
import { decrypt } from "./decrypt";
import {
  isTxnHashUsed,
  jsonError,
  jsonResponse,
  markTxnHashAsUsed,
  verifyPayment,
} from "./utils";
import { updateLeaderBoard } from "./lb";

export async function generateImage(req: Request) {
  try {
    const body = await req.json();
    const { hash, imageBase64user, txnHash } = body;

    if (!hash || typeof hash !== "string") {
      return Response.json(
        { error: "Request body must include a 'hash' string" },
        { status: 400 },
      );
    }

    if (!imageBase64user || typeof imageBase64user !== "string") {
      return Response.json(
        { error: "Request body must include 'imageBase64' string" },
        { status: 400 },
      );
    }

    const isUsed = await isTxnHashUsed(txnHash);

    if (isUsed) {
      return Response.json({ error: "Txn Hash already used" }, { status: 400 });
    }

    const decryptedPrompt = await decrypt(hash);

    if (!decryptedPrompt) {
      return Response.json(
        { error: "Failed to decrypt hash or invalid hash" },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_2 });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: decryptedPrompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64user,
              },
            },
          ],
        },
      ],
    });

    let imageBase64 = null;
    let textResponse = null;

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        textResponse = part.text;
      }
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
      }
    }

    if (!imageBase64) {
      return Response.json(
        { error: "No image generated", text: textResponse },
        { status: 400 },
      );
    }

    // Add "data:image/png;base64," prefix so frontend can use directly
    const imageBase64WithPrefix = `data:image/png;base64,${imageBase64}`;
    await markTxnHashAsUsed(txnHash).catch();
    updateLeaderBoard(txnHash).catch();

    return Response.json(
      {
        success: true,
        imageBase64: imageBase64WithPrefix,
        text: textResponse,
        downloadUrl: `/download-image?data=${encodeURIComponent(imageBase64)}`,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    );
  } catch (error: any) {
    console.error("Error generating image:", error);
    return Response.json(
      {
        error: "Failed to generate image",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function generateImagePreview(req: Request) {
  try {
    const body = await req.json();
    const { prompt: detailedPrompt, imageBase64Creator } = body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_2 });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: detailedPrompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64Creator,
              },
            },
          ],
        },
      ],
    });

    let imageBase64 = null;
    let textResponse = null;

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        textResponse = part.text;
      }
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
      }
    }

    if (!imageBase64) {
      return Response.json(
        { error: "No image generated", text: textResponse },
        { status: 400 },
      );
    }

    // Add "data:image/png;base64," prefix so frontend can use directly
    const imageBase64WithPrefix = `data:image/png;base64,${imageBase64}`;

    return Response.json(
      {
        success: true,
        imageBase64: imageBase64WithPrefix,
        text: textResponse,
        downloadUrl: `/download-image?data=${encodeURIComponent(imageBase64)}`,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    );
  } catch (error: any) {
    console.error("Error saving image:", error);
    return Response.json(
      { error: "Failed to generate image", details: error.message },
      { status: 500 },
    );
  }
}
