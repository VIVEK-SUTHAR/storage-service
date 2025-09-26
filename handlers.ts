import { decrypt } from "./decrypt";
import { storeEncrypted } from "./encrypted-storage";
import { jsonError, jsonResponse } from "./utils";
import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";

const PAYER_KEY = process.env.PAYER_KEY!;
const synapse = await Synapse.create({
  privateKey: PAYER_KEY,
  rpcURL: RPC_URLS.calibration.websocket,
});

export async function handleStore(req: Request) {
  const { data } = await req.json();

  if (!data || typeof data !== "string") {
    return jsonError("Request body must include a 'data' string", 400);
  }

  if (data.length < 79) {
    return jsonError("Data must be at least 79 bytes", 400);
  }

  const uploadResult = await synapse.storage.upload(
    new TextEncoder().encode(data),
    { withCDN: true },
  );

  return jsonResponse({
    message: "Upload complete",
    pieceCid: uploadResult.pieceCid,
  });
}

export async function handleStoreEncrypted(req: Request) {
  const { prompt: data } = await req.json();

  if (!data || typeof data !== "string") {
    return jsonError("Request body must include a 'prompt' string", 400);
  }

  const uploadResult = await storeEncrypted(data);

  return jsonResponse({
    message: "Upload complete",
    hash: uploadResult,
  });
}

export async function handleRetrieveHash(cid: string) {
  const data = await decrypt(cid);
  return jsonResponse({ cid, data });
}

export async function handleRetrieve(cid: string) {
  const data = await synapse.storage.download(cid);
  const decoded = new TextDecoder().decode(data);
  return jsonResponse({ cid, data: decoded });
}
