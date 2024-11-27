import { Connection, Keypair } from "@solana/web3.js";
import { OPERATE_SYSTEM_SECRET_KEY } from "../../accounts/dev";
import "dotenv/config";
import { getProgram } from "../utils";
import { setPriceFeedAccount } from "../instructions/set-price-feed-account";

const ownerAccountSetting = Keypair.fromSecretKey(
  Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
);

const programId = process.env.PROGRAM_ID as string;
const connection = new Connection(process.env.RPC_URL as string, "confirmed");
const program = getProgram(programId, connection.rpcEndpoint);

// Create usdc price feed account
// Get price data in here https://www.pyth.network/price-feeds/crypto-usdc-usd
(async () => {
  await setPriceFeedAccount({
    price: 99988937,
    conf: 94347,
    expo: -8,
    priceFeedId: process.env.USDC_USD_PRICE_FEED_NAME as string,
    connection,
    ownerAccountSetting,
    program,
  });
})();

(async () => {
  await setPriceFeedAccount({
    price: 242114300621,
    conf: 242114300621,
    expo: -8,
    priceFeedId: process.env.ETH_USD_PRICE_FEED_NAME as string,
    connection,
    ownerAccountSetting,
    program,
  });
})();
