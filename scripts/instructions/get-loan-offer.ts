import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { EnsoLending } from "../../target/types/enso_lending";

export const getLoanOffer = async (params: {
  loanOfferId: string;
  borrower: PublicKey;
  program: Program<EnsoLending>;
}): Promise<void> => {
  const { borrower, loanOfferId, program } = params;
  const seedLoanOffer = [
    Buffer.from("enso"),
    Buffer.from("loan_offer"),
    borrower.toBuffer(),
    Buffer.from(loanOfferId),
    program.programId.toBuffer(),
  ];

  const [loanOfferPubkey, _] = PublicKey.findProgramAddressSync(
    seedLoanOffer,
    program.programId
  );

  const data = await program.account.loanOfferAccount.fetch(loanOfferPubkey);
  console.log("data: ", data);
  console.log(data.startedAt.toNumber());
};
