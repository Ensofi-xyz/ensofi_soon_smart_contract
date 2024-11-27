import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { log } from "../utils";

export const initSettingAccount = async (params: {
  amount: number;
  duration: number;
  tierId: string;
  lenderFeePercent: number;
  borrowerFeePercent: number;
  settingAccount: PublicKey;
  ownerAccountSetting: Keypair;
  hotWallet: PublicKey;
  program: Program;
  connection: Connection;
}): Promise<void> => {
  const {
    amount,
    duration,
    lenderFeePercent,
    borrowerFeePercent,
    tierId,
    settingAccount,
    ownerAccountSetting,
    hotWallet,
    connection,
    program,
  } = params;

  const transaction = await program.methods
    .initSettingAccount(
      tierId,
      new anchor.BN(amount),
      new anchor.BN(duration),
      lenderFeePercent,
      borrowerFeePercent
    )
    .accounts({
      owner: ownerAccountSetting.publicKey,
      receiver: hotWallet,
      settingAccount,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  await sendAndConfirmTransaction(connection, transaction, [
    ownerAccountSetting,
  ]).then((tx) => {
    log(connection, tx);
  });

  console.log(
    "🚀 ~ Finish Init Setting Account Tier ID: ",
    tierId,
    ", Pubkey: ",
    settingAccount.toString()
  );
};
