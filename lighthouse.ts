import { ethers } from "ethers";
import lighthouse from "@lighthouse-web3/sdk";

const PAYER_KEY = process.env.PAYER_KEY!;
const signer = new ethers.Wallet(PAYER_KEY);

const signAuthMessage = async (
  privateKey: string,
  verificationMessage: string,
) => {
  const signer = new ethers.Wallet(privateKey);
  const signedMessage = await signer.signMessage(verificationMessage);
  return signedMessage;
};

const getVerificationMessage = async (publicKey: string) => {
  try {
    const response = await fetch(
      `https://api.lighthouse.storage/api/auth/get_message?publicKey=${publicKey}`,
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

    const verificationMessage = await response.json();
    return verificationMessage;
  } catch (error) {
    console.error("Error fetching verification message:", error);
    throw error;
  }
};
const getApiKey = async () => {
  const verificationMessage = await getVerificationMessage(signer.address);
  const signedMessage = await signAuthMessage(
    signer.privateKey,
    verificationMessage,
  );
  const response = await lighthouse.getApiKey(signer.address, signedMessage);
  console.log(response);
};

getApiKey();
