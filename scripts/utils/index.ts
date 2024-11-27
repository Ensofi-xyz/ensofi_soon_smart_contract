import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { EnsoLending } from "../../target/types/enso_lending";
import * as ensoLendingIDL from "../../target/idl/enso_lending.json";

const idl = JSON.parse(JSON.stringify(ensoLendingIDL));

export const getProgram = (
  programId: string,
  endpoint: string
): anchor.Program<EnsoLending> => {
  const connection = new Connection(endpoint, "confirmed");

  return new anchor.Program<EnsoLending>(idl, programId, { connection });
};

export const log = (connection: Connection, tx: string) => {
  console.log(
    `https://explorer.solana.com/transaction/${tx}?cluster=custom&customUrl=${connection.rpcEndpoint}`
  );
};
