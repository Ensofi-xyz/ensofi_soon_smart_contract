import { Connection, PublicKey } from "@solana/web3.js";
import "dotenv/config";
import { getProgram } from "../utils";
import { getLoanOffer } from "../instructions/get-loan-offer";

(async () => {
  const programId = process.env.PROGRAM_ID as string;
  const connection = new Connection(process.env.RPC_URL as string, "confirmed");
  const program = getProgram(programId, connection.rpcEndpoint);

  await getLoanOffer({
    borrower: new PublicKey("3TmfTPbhV6QDsu6kTbdkFTYKNjJQoTwLHBcb65CE1M3U"), // pass borrower wallet here
    loanOfferId: "borrow_offer_1M3U_1725550925110", // pass loan offer id need to migrate
    program: program,
  });
})();
