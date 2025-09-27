import { redis } from "bun";
import { rpcClient } from "./viem";

export function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export async function verifyPayment(txnHash: string) {
  try {
    const receipt = await rpcClient.getTransactionReceipt({
      hash: txnHash as `0x${string}`,
    });

    if (!receipt || !receipt.blockNumber) {
      return { valid: false, reason: "Transaction not found or pending" };
    }

    const block = await rpcClient.getBlock({
      blockNumber: receipt.blockNumber,
    });

    if (!block || !block.timestamp) {
      return { valid: false, reason: "Block info not available" };
    }

    const blockTimeMs = Number(block.timestamp) * 1000;
    const now = Date.now();
    const diffMinutes = (now - blockTimeMs) / (1000 * 60);

    if (diffMinutes > 10) {
      return { valid: false, reason: "Transaction too old" };
    }
    if (
      receipt.contractAddress &&
      receipt.contractAddress !== process.env.PROMTPAY_CONTRACT
    ) {
      return { valid: false, reason: "Transaction to wrong contract" };
    }

    if (receipt.status !== "success") {
      return { valid: false, reason: "Transaction failed" };
    }

    return { valid: true, txnHash, blockNumber: receipt.blockNumber };
  } catch (error: any) {
    return { valid: false, reason: error.message || "Verification error" };
  }
}

export async function downloadImage(imageData: string | null) {
  try {
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

export async function markTxnHashAsUsed(txnHash: string) {
  try {
    await redis.set(`txn:${txnHash}`, "used");
  } catch (error) {}
}

export async function isTxnHashUsed(txnHash: string): Promise<boolean> {
  try {
    const value = await redis.get(`txn:${txnHash}`);

    if (value === "used") {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking/setting transaction hash:", error);
    throw error;
  }
}
