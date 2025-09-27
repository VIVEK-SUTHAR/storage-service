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
import { downloadImage, jsonError, jsonResponse, verifyPayment } from "./utils";
import { redis } from "bun";
import { GoogleGenAI } from "@google/genai";
import { generateImage, generateImagePreview } from "./ai";
import { addPaymentDetailes } from "./payment";
import { addAbortListener } from "events";
import { getLeaderBoard } from "./lb";

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

      if (url.pathname === "/add-payment" && req.method === "POST") {
        return await addPaymentDetailes(req);
      }

      if (url.pathname === "/generate-image" && req.method === "POST") {
        return await generateImage(req);
      }

      if (
        url.pathname === "/generate-prompt-preview" &&
        req.method === "POST"
      ) {
        return await generateImagePreview(req);
      }

      if (url.pathname === "/download-image" && req.method === "GET") {
        const imageData = url.searchParams.get("data");
        return await downloadImage(imageData);
      }

      if (url.pathname === "/get-leaderboard" && req.method === "GET") {
        try {
          const lb = await getLeaderBoard(10);
          return jsonResponse(lb, 200);
        } catch (error) {
          return jsonError(error.message, 500);
        }
      }
      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return jsonError((err as Error).message, 500);
    }
  },
});

console.log(`Server running at http://localhost:${server.port}`);
