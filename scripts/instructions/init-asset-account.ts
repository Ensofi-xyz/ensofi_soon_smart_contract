import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnsoLending } from "../../target/types/enso_lending";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { log } from "../utils";

export const initAsset = async (params: {
  name: string;
  isLend: boolean;
  isCollateral: boolean;
  priceFeedId: string;
  priceFeedAccount: PublicKey;
  tokenMint: PublicKey;
  maxPriceAgeSeconds: number;
  asset: PublicKey;
  ownerAccountSetting: Keypair;
  program: Program<EnsoLending>;
  connection: Connection;
}): Promise<void> => {
  const {
    name,
    asset,
    isCollateral,
    isLend,
    ownerAccountSetting,
    priceFeedAccount,
    priceFeedId,
    tokenMint,
    maxPriceAgeSeconds,
    program,
    connection,
  } = params;

  const transaction = await program.methods
    .initAsset(
      name,
      isLend,
      isCollateral,
      priceFeedId,
      new anchor.BN(maxPriceAgeSeconds)
    )
    .accounts({
      asset,
      owner: ownerAccountSetting.publicKey,
      priceFeedAccount: priceFeedAccount,
      systemProgram: SystemProgram.programId,
      tokenMint,
    })
    .transaction();

  await sendAndConfirmTransaction(connection, transaction, [
    ownerAccountSetting,
  ]).then((tx) => {
    log(connection, tx);
  });

  console.log(
    "🚀 ~ Finish Init Asset for Token: ",
    name,
    ", Pubkey: ",
    asset.toString()
  );
};
