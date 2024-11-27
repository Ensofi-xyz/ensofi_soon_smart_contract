import fs from "fs";
import csvParser from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
//import { isValidWalletAddress, sleep } from "./common.js";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
dotenv.config();

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

const distributedLogWriter = createObjectCsvWriter({
  path: "distributed_usdc_token_output.csv",
  header: [
    { id: "txHash", title: "TxHash" },
    { id: "addresses", title: "Addresses" },
  ],
  append: true,
});

const errorWallets = createObjectCsvWriter({
  path: "wallet_error_output.csv",
  header: [
    { id: "walletAddress", title: "walletAddress" },
    { id: "quantity", title: "quantity" },
  ],
  append: true,
});

const invalidWallets = createObjectCsvWriter({
  path: "wallet_invalid_output.csv",
  header: [
    { id: "walletAddress", title: "walletAddress" },
    { id: "quantity", title: "quantity" },
  ],
  append: true,
});

const splitAddresses = (addresses) => {
  const chunkAddresses = addresses.reduce((chunk, item, index) => {
    const chunkIndex = Math.floor(index / PER_CHUNK);

    if (!chunk[chunkIndex]) {
      chunk[chunkIndex] = [];
    }

    chunk[chunkIndex].push(item);

    return chunk;
  }, []);
  return chunkAddresses;
};

const mintUsdcToken = async (receivers: any[]) => {
  const mintTokenType: string = "spl2022"; // change this if used token legacy
  const mintTokenDecimals: number = MINT_TOKEN_DECIMALS;
  const tokenMint = new PublicKey(SPL_TOKEN_2022_MINT);
  const keypair = Keypair.fromSecretKey(Uint8Array.from(USDC_PRIVATE_KEY));
  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    tokenMint,
    keypair.publicKey,
    false,
    null,
    null,
    TOKEN_2022_PROGRAM_ID
  );
  const transaction = new Transaction();
  for (const receiver of receivers) {
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      tokenMint,
      new PublicKey(receiver.walletAddress),
      false,
      null,
      null,
      TOKEN_2022_PROGRAM_ID
    );
    const ix = createTransferCheckedInstruction(
      fromTokenAccount.address,
      tokenMint,
      toTokenAccount.address,
      keypair.publicKey,
      Number(receiver.quantity) * 10 ** mintTokenDecimals,
      mintTokenDecimals,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    transaction.add(ix);
  }
  const sig = await sendAndConfirmTransaction(connection, transaction, [
    keypair,
  ]);
  console.log("sig", sig);
};

const distributeUsdcToken = async () => {
  const receivers = [];
  fs.createReadStream(DISTRIBUTE_USDC_TOKEN_CSV_PATH)
    .pipe(csvParser())
    .on("error", (err) => {
      console.error("Error while reading CSV file:", err);
    })
    .on("data", (row) => {
      if (isValidWalletAddress(row.walletAddress)) {
        receivers.push(row);
      } else {
        console.log("Invalid address:", row.walletAddress);
        invalidWallets
          .writeRecords([row])
          .then(() => console.log("Write invalid address log done"))
          .catch((err) => console.error(err));
      }
    })
    .on("end", async () => {
      console.log("Read distribute usdc token csv file successfully");
      const chunkAddresses = splitAddresses(receivers);
      for (const chunk of chunkAddresses) {
        try {
          console.log(chunk);
          await mintUsdcToken(chunk);
          await sleep(1000); // Sleep 1s
        } catch (err) {
          console.log(
            "Failed to distribute usdc token to addresses:",
            chunk,
            err
          );
          const dataToWrite = [
            {
              txHash: `Error ${err.message}`,
              addresses: chunk,
            },
          ];

          distributedLogWriter
            .writeRecords(dataToWrite)
            .then(() => console.log("Write error log done"))
            .catch((err) => console.error(err));

          errorWallets
            .writeRecords(chunk)
            .then(() => console.log("Write error log done"))
            .catch((err) => console.error(err));
        }
      }
    });
};

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

distributeUsdcToken();
