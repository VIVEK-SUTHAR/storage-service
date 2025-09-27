import { redis } from "bun";
import { jsonError, jsonResponse, verifyPayment } from "./utils";

export async function addPaymentDetailes(req: Request) {
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
      return jsonResponse({ success: true, txnHash, status: "unused" }, 201);
    } else {
      return jsonError("txn invalid", 400);
    }
  } catch (error) {
    return jsonError("Invalid request body", 400);
  }
}
