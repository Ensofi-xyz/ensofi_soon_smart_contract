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

export const setPriceFeedAccount = async (params: {
  price: number;
  expo: number;
  conf: number;
  priceFeedId: string;
  program: Program<EnsoLending>;
  ownerAccountSetting: Keypair;
  connection: Connection;
}): Promise<void> => {
  const {
    price,
    expo,
    conf,
    priceFeedId,
    program,
    connection,
    ownerAccountSetting,
  } = params;

  const seedPriceFeed = [
    Buffer.from("enso"),
    Buffer.from(priceFeedId),
    program.programId.toBuffer(),
  ];

  const priceFeedAccount = PublicKey.findProgramAddressSync(
    seedPriceFeed,
    program.programId
  )[0];

  const tx = await program.methods
    .setPriceFeedAccount(
      priceFeedId,
      new anchor.BN(price),
      expo,
      new anchor.BN(conf)
    )
    .accounts({
      owner: ownerAccountSetting.publicKey,
      priceFeedAccount,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  await sendAndConfirmTransaction(connection, tx, [ownerAccountSetting]).then(
    (tx) => {
      log(connection, tx);
    }
  );

  console.log("🚀 ~ Finish set price feed account: ", priceFeedAccount);
};
