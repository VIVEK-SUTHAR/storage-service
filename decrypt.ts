import fs from "fs";
import { ethers } from "ethers";
import lighthouse from "@lighthouse-web3/sdk";
import { sign } from "crypto";

const PAYER_KEY = process.env.PAYER_KEY!;
const signer = new ethers.Wallet(PAYER_KEY);
const signAuthMessage = async (publicKey, privateKey) => {
  const provider = new ethers.JsonRpcProvider();
  const signer = new ethers.Wallet(privateKey, provider);
  const messageRequested = (await lighthouse.getAuthMessage(publicKey)).data
    .message!;
  const signedMessage = await signer.signMessage(messageRequested);
  return signedMessage;
};

export const decrypt = async (hash: string) => {
  const privateKey = process.env.PAYER_KEY;

  const signedMessage = await signAuthMessage(signer.address, privateKey);
  const fileEncryptionKey = await lighthouse.fetchEncryptionKey(
    hash,
    signer.address,
    signedMessage,
  );

  const decrypted = await lighthouse.decryptFile(
    hash,
    fileEncryptionKey.data.key,
  );
  const text = new TextDecoder().decode(decrypted);
  return text;
};
