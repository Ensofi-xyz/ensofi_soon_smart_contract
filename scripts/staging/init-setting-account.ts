import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  OPERATE_SYSTEM_SECRET_KEY,
  HOT_WALLET_SECRET_KEY,
  PROGRAM_ID,
} from "../../accounts/staging";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnsoLending } from "../../target/types/enso_lending";
import enso_lending_idl from "../../target/idl/enso_lending.json";
import "dotenv/config";

const enso_lending_idl_string = JSON.stringify(enso_lending_idl);
const enso_lending_idl_obj = JSON.parse(enso_lending_idl_string);
const programId = new PublicKey(PROGRAM_ID);
const connection = new Connection(process.env.RPC_URL as string, "confirmed");

const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);
const hotWallet = Keypair.fromSecretKey(Uint8Array.from(HOT_WALLET_SECRET_KEY));

const providerWallet = new anchor.Wallet(Keypair.generate());

console.log(`Provider Wallet: ${providerWallet.publicKey.toBase58()}`);

const provider = new anchor.AnchorProvider(
  connection,
  providerWallet,
  AnchorProvider.defaultOptions()
);

const program = new Program<EnsoLending>(
  enso_lending_idl_obj,
  programId,
  provider
);

const initSettingAccount = async (params: {
  amount: number;
  duration: number;
  tierId: string;
  lenderFeePercent: number;
  borrowerFeePercent: number;
  settingAccount: anchor.web3.PublicKey;
  ownerAccountSetting: Keypair;
  hotWallet: PublicKey;
}) => {
  const {
    amount,
    duration,
    lenderFeePercent,
    borrowerFeePercent,
    tierId,
    settingAccount,
    ownerAccountSetting,
    hotWallet,
  } = params;
  return await program.methods
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
};

const DURATION_TO_SECOND = 1209600; // 14 days

const log = (tx: string) => {
  console.log(
    `https://explorer.solana.com/transaction/${tx}?cluster=custom&customUrl=${connection.rpcEndpoint}`
  );
};

(async () => {
  const amount = 1000; // 1000 USDC
  const duration = DURATION_TO_SECOND;
  const tierId = "solana_tier_005";
  const lenderFeePercent = 5;
  const borrowerFeePercent = 5;

  const seedSettingAccount = [
    Buffer.from("enso"),
    Buffer.from("setting_account"),
    Buffer.from(tierId),
    program.programId.toBuffer(),
  ];

  const settingAccount = PublicKey.findProgramAddressSync(
    seedSettingAccount,
    program.programId
  )[0];

  const transaction = await initSettingAccount({
    amount,
    duration,
    tierId,
    lenderFeePercent,
    settingAccount,
    borrowerFeePercent,
    ownerAccountSetting: ownerAccountSetting,
    hotWallet: hotWallet.publicKey,
  });

  await sendAndConfirmTransaction(connection, transaction, [
    ownerAccountSetting,
  ]).then((tx) => {
    log(tx);
  });
})();
