import { Connection } from "@solana/web3.js";

export const RPC_URL: string = process.env.RPC_URL;
export const DISTRIBUTE_USDC_TOKEN_CSV_PATH: string =
  process.env.DISTRIBUTE_USDC_TOKEN_CSV_PATH;
export const PER_CHUNK = Number(process.env.PER_CHUNK || "1");
export const MINT_TOKEN_DECIMALS: number = 6;
export const USDC_PRIVATE_KEY: number[] = process.env.USDC_PRIVATE_KEY.split(
  ","
).map((val) => parseInt(val));
export const SPL_TOKEN_2022_MINT: string = process.env.SPL_TOKEN_2022_MINT;

export const connection = new Connection(RPC_URL, "confirmed");
