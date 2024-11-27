import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getProgram } from "../utils";
import {
  OPERATE_SYSTEM_SECRET_KEY,
  HOT_WALLET_SECRET_KEY,
} from "../../accounts/testnet";
import { setPriceFeedAccount } from "../instructions/set-price-feed-account";
import { initAsset } from "../instructions/init-asset-account";
import { initSettingAccount } from "../instructions/init-setting-account";

const programId = process.env.PROGRAM_ID as string;
const connection = new Connection(process.env.RPC_URL as string, "confirmed");
const program = getProgram(programId, connection.rpcEndpoint);
const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);
const hotWallet = Keypair.fromSecretKey(Uint8Array.from(HOT_WALLET_SECRET_KEY));
const durationToSecond = parseInt(process.env.DURATION_TO_SECOND);

// Config offer template available
const offerTemplateConfigs = [
  {
    amount: 100,
    tierId: "eclipse_tier_100",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 200,
    tierId: "eclipse_tier_200",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 500,
    tierId: "eclipse_tier_500",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 1000,
    tierId: "eclipse_tier_1000",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 2000,
    tierId: "eclipse_tier_2000",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 5000,
    tierId: "eclipse_tier_5000",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
  {
    amount: 10000,
    tierId: "eclipse_tier_10000",
    duration: durationToSecond,
    lenderFeePercent: 5,
    borrowerFeePercent: 5,
  },
];

(async () => {
  // Init Price feed account for Asset
  const usdcMint = new PublicKey(process.env.USDC_MINT_ADDRESS as string);
  const USDCUSDPriceFeedName = process.env.USDC_USD_PRICE_FEED_NAME as string;
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
  const ethMint = new PublicKey(process.env.ETH_MINT_ADDRESS as string);
  const ethPrice = 202114300621;
  const ethExpo = -8;
  const ethConf = 202114300621;
  const ETHUSDPriceFeedName = process.env.ETH_USD_PRICE_FEED_NAME as string;

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

  // Init asset account
  const seedUSDCAssetAccount = [
    Buffer.from("enso"),
    Buffer.from("asset"),
    usdcMint.toBuffer(),
    program.programId.toBuffer(),
  ];
  const usdcAssetAccount = PublicKey.findProgramAddressSync(
    seedUSDCAssetAccount,
    program.programId
  )[0];

  await initAsset({
    name: "USDC",
    isLend: true,
    isCollateral: false,
    priceFeedId: USDCUSDPriceFeedName,
    priceFeedAccount: usdcPriceFeedAccount,
    tokenMint: usdcMint,
    maxPriceAgeSeconds: 75,
    asset: usdcAssetAccount,
    ownerAccountSetting: ownerAccountSetting,
    connection,
    program,
  });

  const seedETHAssetAccount = [
    Buffer.from("enso"),
    Buffer.from("asset"),
    ethMint.toBuffer(),
    program.programId.toBuffer(),
  ];
  const ethAssetAccount = PublicKey.findProgramAddressSync(
    seedETHAssetAccount,
    program.programId
  )[0];

  await initAsset({
    name: "ETH",
    isLend: false,
    isCollateral: true,
    priceFeedId: ETHUSDPriceFeedName,
    priceFeedAccount: ethPriceFeedAccount,
    tokenMint: ethMint,
    maxPriceAgeSeconds: 75,
    asset: ethAssetAccount,
    ownerAccountSetting: ownerAccountSetting,
    connection,
    program,
  });

  // Init Setting account
  for (const offerTemplateConfig of offerTemplateConfigs) {
    const { amount, borrowerFeePercent, duration, lenderFeePercent, tierId } =
      offerTemplateConfig;

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
  }
})();
