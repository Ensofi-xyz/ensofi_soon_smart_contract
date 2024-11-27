import { PublicKey } from "@solana/web3.js";

export const isValidWalletAddress = (address: string): boolean => {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBuffer());
  } catch (error) {
    return false;
  }
};

export const sleep = (delay: number) => {
  return new Promise((resolve) => setTimeout(resolve, delay));
};
