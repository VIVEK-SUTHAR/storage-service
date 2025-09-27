import { GoogleGenAI } from "@google/genai";
import { handleRetrieveHash } from "./handlers";
import { hash, redis, serve } from "bun";
import { decrypt } from "./decrypt";
import { jsonError, jsonResponse, verifyPayment } from "./utils";

const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log("AI Service running on", server.port);
