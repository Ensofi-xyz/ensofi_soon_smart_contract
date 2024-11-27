import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { OPERATE_SYSTEM_SECRET_KEY } from "../../accounts/testnet";
import "dotenv/config";
import { getProgram } from "../utils";
import { setPriceFeedAccount } from "../instructions/set-price-feed-account";
import { initAsset } from "../instructions/init-asset-account";

const programId = process.env.PROGRAM_ID as string;
const connection = new Connection(process.env.RPC_URL as string, "confirmed");
const program = getProgram(programId, connection.rpcEndpoint);
const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);

(async () => {
  const tokenMint = new PublicKey(process.env.USDC_MINT_ADDRESS as string);

  const USDCUSDPriceFeedName = process.env.USDC_USD_PRICE_FEED_NAME;

  const usdcPrice = 99988937;
  const usdcExpo = -8;
  const usdcConf = 94347;

  const seedUSDCPriceFeed = [
    Buffer.from("enso"),
    Buffer.from(USDCUSDPriceFeedName),
    program.programId.toBuffer(),
  ];

  const usdcPriceFeedAccount = PublicKey.findProgramAddressSync(
    seedUSDCPriceFeed,
    program.programId
  )[0];

  await setPriceFeedAccount({
    conf: usdcConf,
    expo: usdcExpo,
    price: usdcPrice,
    priceFeedId: USDCUSDPriceFeedName,
    program,
    ownerAccountSetting,
    connection,
  });

  const seedAssetAccount = [
    Buffer.from("enso"),
    Buffer.from("asset"),
    tokenMint.toBuffer(),
    program.programId.toBuffer(),
  ];
  const assetAccount = PublicKey.findProgramAddressSync(
    seedAssetAccount,
    program.programId
  )[0];

  await initAsset({
    name: "USDC",
    isLend: true,
    isCollateral: false,
    priceFeedId: USDCUSDPriceFeedName,
    priceFeedAccount: usdcPriceFeedAccount,
    tokenMint: tokenMint,
    maxPriceAgeSeconds: 75,
    asset: assetAccount,
    ownerAccountSetting: ownerAccountSetting,
    connection,
    program,
  });
})();

// Init asset ETH
(async () => {
  const tokenMint = new PublicKey(process.env.ETH_MINT_ADDRESS as string);

  const ethPrice = 202114300621;
  const ethExpo = -8;
  const ethConf = 202114300621;

  const ETHUSDPriceFeedName = process.env.ETH_USD_PRICE_FEED_NAME;

  const seedETHPriceFeed = [
    Buffer.from("enso"),
    Buffer.from(ETHUSDPriceFeedName),
    program.programId.toBuffer(),
  ];

  const ethPriceFeedAccount = PublicKey.findProgramAddressSync(
    seedETHPriceFeed,
    program.programId
  )[0];

  await setPriceFeedAccount({
    conf: ethConf,
    expo: ethExpo,
    price: ethPrice,
    priceFeedId: ETHUSDPriceFeedName,
    program,
    ownerAccountSetting,
    connection,
  });

  const seedAssetAccount = [
    Buffer.from("enso"),
    Buffer.from("asset"),
    tokenMint.toBuffer(),
    program.programId.toBuffer(),
  ];
  const assetAccount = PublicKey.findProgramAddressSync(
    seedAssetAccount,
    program.programId
  )[0];

  await initAsset({
    name: "ETH",
    isLend: false,
    isCollateral: true,
    priceFeedId: ETHUSDPriceFeedName,
    priceFeedAccount: ethPriceFeedAccount,
    tokenMint: tokenMint,
    maxPriceAgeSeconds: 75,
    asset: assetAccount,
    ownerAccountSetting: ownerAccountSetting,
    connection,
    program,
  });
})();
