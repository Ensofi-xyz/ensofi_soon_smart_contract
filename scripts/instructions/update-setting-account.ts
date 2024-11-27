import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { EnsoLending } from "../../target/types/enso_lending";
import { log } from "../utils";

export const updateSettingAccount = async (params: {
  amount: number;
  duration: number;
  tierId: string;
  lenderFeePercent: number;
  borrowerFeePercent: number;
  settingAccount: PublicKey;
  ownerAccountSetting: Keypair;
  hotWallet: PublicKey;
  program: Program<EnsoLending>;
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
    .editSettingAccount(
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
    "After updated ",
    await program.account.settingAccount.fetch(settingAccount)
  );
};
