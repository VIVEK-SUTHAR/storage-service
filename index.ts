import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import { ethers } from "ethers";
import { storeEncrypted } from "./encrypted-storage";
import { decrypt } from "./decrypt";
import {
  handleRetrieve,
  handleRetrieveHash,
  handleStore,
  handleStoreEncrypted,
} from "./handlers";
import { jsonError, jsonResponse, verifyPayment } from "./utils";
import { redis } from "bun";
import { GoogleGenAI } from "@google/genai";

const PAYER_KEY = process.env.PAYER_KEY!;

const synapse = await Synapse.create({
  privateKey: PAYER_KEY,
  rpcURL: RPC_URLS.calibration.websocket,
});

async function setUpStorage() {
  const amount = ethers.parseUnits("10", 18);
  await synapse.payments.deposit(amount, "USDFC");

  const warmStorageAddress = await synapse.getWarmStorageAddress();
  await synapse.payments.approveService(
    warmStorageAddress,
    ethers.parseUnits("5", 18),
    ethers.parseUnits("10", 18),
    86400n,
  );
}

// await setUpStorage();

const server = Bun.serve({
  port: 3000,
  fetch: async (req) => {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }
    try {
      if (req.method === "POST" && url.pathname === "/store") {
        return await handleStore(req);
      }

      if (req.method === "POST" && url.pathname === "/store-encrypted") {
        return await handleStoreEncrypted(req);
      }

      if (req.method === "GET" && url.pathname.startsWith("/retrieve-hash/")) {
        const cid = url.pathname.split("/")[2];
        if (!cid) return jsonError("hash is required", 400);
        return await handleRetrieveHash(cid);
      }

      if (req.method === "GET" && url.pathname.startsWith("/retrieve/")) {
        const cid = url.pathname.split("/")[2];
        if (!cid) return jsonError("CID is required", 400);
        return await handleRetrieve(cid);
      }

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return jsonError((err as Error).message, 500);
    }

    if (url.pathname === "/add-payment" && req.method === "POST") {
      try {
        const body = await req.json();
        const { txnHash } = body;

        if (!txnHash) {
          return jsonError("txnHash is required", 400);
        }

        const exists = await redis.get(`txn:${txnHash}`);

        if (exists) {
          return jsonError("Transaction hash already used", 409);
        }
        const isValid = await verifyPayment(txnHash);
        if (isValid) {
          await redis.set(`txn:${txnHash}`, "unused");
          return jsonResponse(
            { success: true, txnHash, status: "unused" },
            201,
          );
        } else {
          return jsonError("txn invalid", 400);
        }
      } catch (error) {
        return jsonError("Invalid request body", 400);
      }
    }

    if (url.pathname === "/generate-image" && req.method === "POST") {
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

        const decryptedPrompt = await decrypt(hash);
        if (!decryptedPrompt) {
          return Response.json(
            { error: "Failed to decrypt hash or invalid hash" },
            { status: 400 },
          );
        }

        const ai = new GoogleGenAI({});

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: [
            {
              parts: [
                {
                  text: decryptedPrompt,
                },
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
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            textResponse = part.text;
          } else if (part.inlineData) {
            imageBase64 = part.inlineData.data;
          }
        }

        if (!imageBase64) {
          return Response.json(
            {
              error: "No image generated",
              text: textResponse,
            },
            { status: 400 },
          );
        }

        return Response.json(
          {
            success: true,
            imageBase64,
            text: textResponse,
            downloadUrl: `/download-image?data=${encodeURIComponent(imageBase64)}`,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
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

    if (url.pathname === "/generate-prompt-preview" && req.method === "POST") {
      try {
        const body = await req.json();
        const { prompt, imageBase64Creator } = body;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_3 });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
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

        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            textResponse = part.text;
          } else if (part.inlineData) {
            imageBase64 = part.inlineData.data;
          }
        }

        if (!imageBase64) {
          return Response.json(
            {
              error: "No image generated",
              text: textResponse,
            },
            { status: 400 },
          );
        }

        return Response.json(
          {
            success: true,
            imageBase64,
            text: textResponse,
            downloadUrl: `/download-image?data=${encodeURIComponent(imageBase64)}`,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          },
        );
      } catch (error: any) {
        console.error("Error saving image:", error);
        return Response.json(
          {
            error: "Failed to save image",
            details: error.message as Error,
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/download-image" && req.method === "GET") {
      try {
        const imageData = url.searchParams.get("data");

        if (!imageData) {
          return Response.json(
            { error: "No image data provided" },
            { status: 400 },
          );
        }

        const buffer = Buffer.from(decodeURIComponent(imageData), "base64");

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `gemini-image-${timestamp}.png`;

        return new Response(buffer, {
          headers: {
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error: any) {
        console.error("Error downloading image:", error);
        return Response.json(
          {
            error: "Failed to download image",
            details: error.message,
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/save-image" && req.method === "POST") {
      try {
        const body = await req.json();
        const { imageBase64, filename = "gemini-image.png" } = body;

        if (!imageBase64) {
          return Response.json(
            { error: "Image data is required" },
            { status: 400 },
          );
        }

        // Convert base64 to buffer and save to file
        const buffer = Buffer.from(imageBase64, "base64");
        await Bun.write(filename, buffer);

        return Response.json(
          {
            success: true,
            message: `Image saved as ${filename}`,
            filename,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          },
        );
      } catch (error: any) {
        console.error("Error saving image:", error);
        return Response.json(
          {
            error: "Failed to save image",
            details: error.message,
          },
          { status: 500 },
        );
      }
    }
  },
});

console.log(`Server running at http://localhost:${server.port}`);
