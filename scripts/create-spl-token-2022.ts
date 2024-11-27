// Import necessary functions and constants from the Solana web3.js and SPL Token packages
import {
  sendAndConfirmTransaction,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Cluster,
  PublicKey,
} from "@solana/web3.js";

import {
  ExtensionType,
  createInitializeMintInstruction,
  mintTo,
  createAccount,
  getMintLen,
  getTransferFeeAmount,
  unpackAccount,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferFeeConfigInstruction,
  harvestWithheldTokensToMint,
  transferCheckedWithFee,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import dotenv from "dotenv";
dotenv.config();

// Initialize connection to local Soon node
const connection = new Connection(process.env.RPC_URL, "confirmed");

// Generate keys for payer, mint authority, and mint
const USDC_PRIVATE_KEY = process.env.USDC_PRIVATE_KEY.split(",").map((val) =>
  parseInt(val)
);

const payer = Keypair.fromSecretKey(Uint8Array.from(USDC_PRIVATE_KEY));

const mintAuthority = payer;
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;

// Generate keys for transfer fee config authority and withdrawal authority
const transferFeeConfigAuthority = mintAuthority;
const withdrawWithheldAuthority = mintAuthority;

// Definir as extensões a serem utilizadas para mint
const extensions = [ExtensionType.TransferFeeConfig];

// Calculate the length of the mint
const mintLen = getMintLen(extensions);

// Set the decimals, fee basis points, and maximum fee
const decimals = 6;
const feeBasisPoints = 0; // 0%
const maxFee = BigInt(9 * Math.pow(10, decimals)); // 9 tokens

// Define the amount to be minted and the amount to be transferred, accounting for decimals
const mintAmount = BigInt(1_000_000_000_000 * Math.pow(10, decimals)); // Mint 1,000,000,000,000 tokens
const transferAmount = BigInt(1_000 * Math.pow(10, decimals)); // Transfer 1,000 tokens

// Calculate the fee for the transfer
const calcFee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000); // 0 token
const fee = calcFee > maxFee ? maxFee : calcFee; // expect 9 fee

// Helper function to generate Explorer URL
function generateExplorerTxUrl(txId: string) {
  return `https://explorer.testnet.soo.network/tx/${txId}`;
}

async function main() {
  // Step 1 - Airdrop to Payer
  // const airdropSignature = await connection.requestAirdrop(
  //   payer.publicKey,
  //   2 * LAMPORTS_PER_SOL
  // );

  // await connection.confirmTransaction({
  //   signature: airdropSignature,
  //   ...(await connection.getLatestBlockhash()),
  // });

  // Step 2 - Create a New Token
  const mintLamports = await connection.getMinimumBalanceForRentExemption(
    mintLen
  );
  const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint,
      transferFeeConfigAuthority.publicKey,
      withdrawWithheldAuthority.publicKey,
      feeBasisPoints,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint,
      decimals,
      mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );
  const newTokenTx = await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payer, mintKeypair],
    undefined
  );
  console.log("New Token Created:", generateExplorerTxUrl(newTokenTx));
  console.log("Mint: ", mintKeypair);

  // Step 3 - Mint tokens to Owner
  const owner = payer; // currently the payer is the token owner
  const sourceAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    owner.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );
  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    sourceAccount,
    mintAuthority,
    mintAmount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Tokens Minted:", generateExplorerTxUrl(mintSig));

  // Step 4 - Send Tokens from Owner to a New Account
  // const DESTINATION_OWNER = process.env.DESTINATION_OWNER.split(",").map(
  //   (val) => parseInt(val)
  // );
  // const destinationOwner = Keypair.fromSecretKey(
  //   Uint8Array.from(DESTINATION_OWNER)
  // );
  // const destinationAccount = await createAssociatedTokenAccountIdempotent(
  //   connection,
  //   payer,
  //   mint,
  //   destinationOwner.publicKey,
  //   {},
  //   TOKEN_2022_PROGRAM_ID
  // );
  // const transferSig = await transferCheckedWithFee(
  //   connection,
  //   payer,
  //   sourceAccount,
  //   mint,
  //   destinationAccount,
  //   owner,
  //   transferAmount,
  //   decimals,
  //   fee,
  //   []
  // );
  // console.log("Tokens Transfered:", generateExplorerTxUrl(transferSig));

  // Step 5 - Fetch Fee Accounts
  // const allAccounts = await connection.getProgramAccounts(
  //   TOKEN_2022_PROGRAM_ID,
  //   {
  //     commitment: "confirmed",
  //     filters: [
  //       {
  //         memcmp: {
  //           offset: 0,
  //           bytes: mint.toString(),
  //         },
  //       },
  //     ],
  //   }
  // );

  // const accountsToWithdrawFrom: PublicKey[] = [];
  // for (const accountInfo of allAccounts) {
  //   const account = unpackAccount(
  //     accountInfo.pubkey,
  //     accountInfo.account,
  //     TOKEN_2022_PROGRAM_ID
  //   );
  //   const transferFeeAmount = getTransferFeeAmount(account);
  //   if (
  //     transferFeeAmount !== null &&
  //     transferFeeAmount.withheldAmount > BigInt(0)
  //   ) {
  //     accountsToWithdrawFrom.push(accountInfo.pubkey);
  //   }
  // }

  /**
  // Step 6 - Harvest Fees
  const feeVault = Keypair.generate();
  const feeVaultAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    feeVault.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );

  const withdrawSig1 = await withdrawWithheldTokensFromAccounts(
    connection,
    payer,
    mint,
    feeVaultAccount,
    withdrawWithheldAuthority,
    [],
    accountsToWithdrawFrom
  );
  console.log("Withdraw from Accounts:", generateExplorerTxUrl(withdrawSig1));
  */
}

main();

// New Token Created: https://explorer.dev.eclipsenetwork.xyz/tx/53bZLJrEkhNXjtDCKuxYrFa3zHzqvGmuLWffKeHoy4EVbUuino7gDfqwFTy9pAL2QsagGw2kFpVXxSbE3eUKm5QXy?cluster=devnet
// Mint:  Keypair {
//   _keypair: {
//     publicKey: Uint8Array(32) [
//       127, 197, 138,  89, 164, 182, 226,
//       157, 160,   0, 184, 196, 114, 218,
//       132, 113, 117, 251, 163, 196,  17,
//       163,  42,   3, 135,  45, 211, 120,
//       207,  82, 123, 230
//     ],
//     secretKey: Uint8Array(64) [
//        37,  33,  82,  60,  89, 208, 168, 156, 134, 147, 247,
//       165, 141, 208,  95, 123, 218,   9,  91, 194,   9, 213,
//       147,  55, 238, 188, 223, 173,  86, 215,  93, 207, 127,
//       197, 138,  89, 164, 182, 226, 157, 160,   0, 184, 196,
//       114, 218, 132, 113, 117, 251, 163, 196,  17, 163,  42,
//         3, 135,  45, 211, 120, 207,  82, 123, 230
//     ]
//   }
// }
// Tokens Minted: https://explorer.dev.eclipsenetwork.xyz/tx/4StnRZT4yHH5jgjJ7hwqNQQiFpQLyjrijZ9TeFd5cjpx6yUQu8fgZoMAavuTXwY58huwkE2dmv6D6VRSJcx4PUc7y?cluster=devnet
// Tokens Transfered: https://explorer.dev.eclipsenetwork.xyz/tx/62Ywi3itftEHo7w7BZNYPEyMrs29NGjwELd8rUnzj9m1tdNiRqEb2AnBkStnxCeWnsXMqfUU8uK3rwNSp9sdsH9gy?cluster=devnet
