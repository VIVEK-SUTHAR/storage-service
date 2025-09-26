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
import { jsonError } from "./utils";

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
  },
});

console.log(`Server running at http://localhost:${server.port}`);
