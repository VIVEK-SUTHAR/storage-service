import { ethers, formatEther } from "ethers";
import lighthouse, { fund } from "@lighthouse-web3/sdk";
import { fetch } from "bun";
import { decrypt } from "./decrypt";

const PAYER_KEY = process.env.PAYER_KEY!;
const signer = new ethers.Wallet(PAYER_KEY);

const STORAGE_KEY = process.env.STORAGE_KEY;

const yourText = "ye Ek secret text tha jo sabko batana tha";
const publicKey = signer.address;
const signedMessage = "SIGNATURE/JWT";
const name = "anime";

async function getMessageToSign() {
  try {
    const response = await fetch(
      `https://encryption.lighthouse.storage/api/message/${signer.address}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Message: ${errorData}`,
      );
    }

    const data: Array<{ message: string }> = await response.json();

    if (Array.isArray(data) && data.length > 0 && data[0].message) {
      const messageToSign = data[0].message;
      console.log("Message to sign:", messageToSign);
      return messageToSign;
    } else {
      throw new Error("Invalid response format: message not found.");
    }
  } catch (error) {
    console.error("Error fetching message to sign:", error);
    throw error;
  }
}

export async function storeEncrypted(prompt: string) {
  const messageToSign = await getMessageToSign();
  const sign = await signer.signMessage(messageToSign);
  const response = await lighthouse.textUploadEncrypted(
    prompt,
    STORAGE_KEY!,
    publicKey,
    sign,
  );

  return response.data[0].Hash;
}
