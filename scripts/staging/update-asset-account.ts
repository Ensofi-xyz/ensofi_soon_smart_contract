import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { OPERATE_SYSTEM_SECRET_KEY } from "../../accounts/staging";
import "dotenv/config";
import { getProgram } from "../utils";
import { updateAssetAccount } from "../instructions/update-asset-account";

const programId = process.env.PROGRAM_ID as string;
const connection = new Connection(process.env.RPC_URL as string, "confirmed");
const program = getProgram(programId, connection.rpcEndpoint);

const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);

(async () => {
  const name = "USDC";
  const isLend = false;
  const isCollateral = true;
  const priceFeedName = "ensoUSDCUSDPriceFeed";
  const maxPriceAgeSeconds = 100000;

  const tokenMint = new PublicKey(
    "BP8NGYbS6Xv88xc2afhm7QGj3z5G2UJ5pLCHk9zq1cBY"
  ); // pass token mint in here
  const seedAsset = [
    Buffer.from("enso"),
    Buffer.from("asset"),
    tokenMint.toBuffer(),
    program.programId.toBuffer(),
  ];
  const [asset, _bump] = PublicKey.findProgramAddressSync(
    seedAsset,
    program.programId
  );
  console.log("bump: ", _bump);
  console.log("Previous data ", await program.account.asset.fetch(asset));

  const seedUSDCPriceFeed = [
    Buffer.from("enso"),
    Buffer.from(priceFeedName),
    program.programId.toBuffer(),
  ];

  const priceFeedAccount = PublicKey.findProgramAddressSync(
    seedUSDCPriceFeed,
    program.programId
  )[0];

  await updateAssetAccount({
    name,
    asset,
    isCollateral,
    ownerAccountSetting,
    tokenMint,
    isLend,
    maxPriceAgeSeconds,
    priceFeedAccount,
    connection,
    program,
    priceFeedId: priceFeedName,
  });
})();
