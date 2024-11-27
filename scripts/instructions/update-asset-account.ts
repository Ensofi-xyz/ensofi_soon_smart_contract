import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { EnsoLending } from "../../target/types/enso_lending";
import { log } from "../utils";

export const updateAssetAccount = async (params: {
  name?: string;
  isLend?: boolean;
  isCollateral?: boolean;
  priceFeedId?: string;
  priceFeedAccount?: PublicKey;
  tokenMint: PublicKey;
  maxPriceAgeSeconds?: number;
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
    maxPriceAgeSeconds,
    priceFeedAccount,
    priceFeedId,
    tokenMint,
    ownerAccountSetting,
    connection,
    program,
  } = params;

  const transaction = await program.methods
    .editAsset(
      name,
      isLend,
      isCollateral,
      priceFeedId,
      maxPriceAgeSeconds ? new anchor.BN(maxPriceAgeSeconds) : null
    )
    .accounts({
      asset,
      owner: ownerAccountSetting.publicKey,
      priceFeedAccount: priceFeedAccount ? priceFeedAccount : null,
      tokenMint,
    })
    .transaction();

  await sendAndConfirmTransaction(connection, transaction, [
    ownerAccountSetting,
  ]).then((tx) => {
    log(connection, tx);
  });

  console.log("After updated ", await program.account.asset.fetch(asset));
};
