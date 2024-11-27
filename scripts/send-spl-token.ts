import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL;
const FROM_WALLET = process.env.FROM_WALLET.split(",").map((val) =>
  parseInt(val)
);
const toWallet = new PublicKey(process.env.TO_WALLET);
const fromWallet = Keypair.fromSecretKey(Uint8Array.from(FROM_WALLET));
const amount = 1000;

console.log("FromWallet", fromWallet.publicKey.toBase58());
console.log("To Wallet", toWallet.toBase58());
console.log("Amount", amount);

const tokenMint = new PublicKey(process.env.SPL_TOKEN_2022_MINT);
const getTokenProgramId = (splType: "spl" | "spl2022"): PublicKey => {
  if (splType === "spl") {
    return TOKEN_PROGRAM_ID;
  } else {
    return TOKEN_2022_PROGRAM_ID;
  }
};

(async () => {
  const connection = new Connection(RPC_URL, "confirmed");
  const mintTokenType: string = "spl2022"; // change this if used token legacy
  const mintTokenDecimals: number = 6;

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromWallet,
    tokenMint,
    fromWallet.publicKey,
    false,
    null,
    null,
    getTokenProgramId("spl2022")
  );
  console.log("FromAta: ", fromTokenAccount.address.toString());
  console.log(
    "From Wallet balance: ",
    await connection.getTokenAccountBalance(fromTokenAccount.address)
  );
  console.log(
    "From Wallet balance Native: ",
    (await connection.getBalance(fromWallet.publicKey)) / LAMPORTS_PER_SOL,
    " ETH/SOL"
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromWallet,
    tokenMint,
    toWallet,
    false,
    null,
    null,
    getTokenProgramId("spl2022")
  );
  console.log("ToAta: ", toTokenAccount.address.toString());
  console.log(
    "To Wallet balance: ",
    await connection.getTokenAccountBalance(toTokenAccount.address)
  );
  console.log(
    "To Wallet balance Native: ",
    (await connection.getBalance(toWallet)) / LAMPORTS_PER_SOL,
    " ETH/SOL"
  );

  const ix =
    mintTokenType === "spl2022"
      ? createTransferCheckedInstruction(
          fromTokenAccount.address,
          tokenMint,
          toTokenAccount.address,
          fromWallet.publicKey,
          amount * 10 ** mintTokenDecimals,
          mintTokenDecimals,
          [],
          getTokenProgramId("spl2022")
        )
      : createTransferInstruction(
          fromTokenAccount.address,
          toTokenAccount.address,
          fromWallet.publicKey,
          amount * 10 ** mintTokenDecimals,
          [],
          getTokenProgramId("spl")
        );

  const transaction = new Transaction().add(ix);

  const tx = await sendAndConfirmTransaction(connection, transaction, [
    fromWallet,
  ]);
  console.log("tx: ", tx);
})();
