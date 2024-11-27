import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  OPERATE_SYSTEM_SECRET_KEY,
  HOT_WALLET_SECRET_KEY,
} from "../../accounts/staging";
import "dotenv/config";
import { getProgram } from "../utils";
import { initSettingAccount } from "../instructions/init-setting-account";

const programId = process.env.PROGRAM_ID as string;
const connection = new Connection(process.env.RPC_URL as string, "confirmed");
const program = getProgram(programId, connection.rpcEndpoint);

const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);
const hotWallet = Keypair.fromSecretKey(Uint8Array.from(HOT_WALLET_SECRET_KEY));

const DURATION_TO_SECOND = 1209600; // 14 days

(async () => {
  const amount = 100; // 100 USDC
  const duration = DURATION_TO_SECOND;
  const tierId = "eclipse_tier_100";
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

  await initSettingAccount({
    amount,
    duration,
    tierId,
    lenderFeePercent,
    settingAccount,
    borrowerFeePercent,
    ownerAccountSetting: ownerAccountSetting,
    hotWallet: hotWallet.publicKey,
    connection,
    program,
  });
})();
