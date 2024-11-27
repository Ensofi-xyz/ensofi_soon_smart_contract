import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { EnsoLending } from "../../target/types/enso_lending";


const program = anchor.workspace.EnsoLending as anchor.Program<EnsoLending>;

export const initSettingAccount = async (params: {
  amount: number;
  duration: number;
  tierId: string;
  lenderFeePercent: number;
  borrowerFeePercent: number;
  settingAccount: anchor.web3.PublicKey;
  ownerKeypair: Keypair
  hotWallet: PublicKey
}): Promise<void> => {
  const {
    amount,
    duration,
    lenderFeePercent,
    borrowerFeePercent,
    tierId,
    settingAccount,
    ownerKeypair,
    hotWallet,
  } = params;
  await program.methods
    .initSettingAccount(
      tierId,
      new anchor.BN(amount),
      new anchor.BN(duration),
      lenderFeePercent,
      borrowerFeePercent
    )
    .accounts({
      owner: ownerKeypair.publicKey,
      receiver: hotWallet,
      settingAccount,
      systemProgram: SystemProgram.programId,
    })
    .signers([ownerKeypair])
    .rpc()
};

export const initAsset = async (params: {
  name: string,
  isLend: boolean,
  isCollateral: boolean
  priceFeedId: string,
  priceFeedAccount: PublicKey,
  tokenMint: PublicKey,
  maxPriceAgeSeconds: number,
  asset: PublicKey
  ownerKeypair: Keypair,
}) => {
  const {
    name,
    asset, 
    isCollateral,
    isLend,
    ownerKeypair,
    priceFeedAccount, 
    priceFeedId,
    tokenMint,
    maxPriceAgeSeconds, 
  } = params

  await program.methods.initAsset(
    name,
    isLend,
    isCollateral,
    priceFeedId,
    new anchor.BN(maxPriceAgeSeconds)
  ).accounts({
    asset,
    owner: ownerKeypair.publicKey,
    priceFeedAccount: priceFeedAccount,
    systemProgram: SystemProgram.programId,
    tokenMint
  })
  .signers([ownerKeypair])
  .rpc()
}

export const createLendOffer = async (params: {
  hotWalletAta: PublicKey;
  lender: Keypair;
  lenderAtaAsset: PublicKey;
  lendOffer: PublicKey;
  mintAsset: PublicKey;
  settingAccount: PublicKey;
  offerId: string;
  tierId: string;
  interest: number;
}): Promise<void> => {
  const {
    hotWalletAta,
    interest,
    lendOffer,
    lender,
    lenderAtaAsset,
    mintAsset,
    offerId,
    settingAccount,
    tierId,
  } = params;

  await program.methods
    .createLendOffer(offerId, tierId, interest)
    .accounts({
      hotWalletAta,
      lender: lender.publicKey,
      lenderAtaAsset,
      lendOffer,
      mintAsset,
      settingAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([lender])
    .rpc()
};

export const editLendOffer = async (params: {
  offerId: string;
  interest: number;
  lendOffer: PublicKey;
  lender: Keypair;
}): Promise<void> => {
  const { interest, lendOffer, offerId, lender } = params;

  await program.methods
    .editLendOffer(offerId, interest)
    .accounts({
      lender: lender.publicKey,
      lendOffer,
    })
    .signers([lender])
    .rpc()
};

export const cancelLendOffer = async (params: {
  offerId: string;
  lendOffer: PublicKey;
  lender: Keypair;
}): Promise<void> => {
  const { offerId, lendOffer, lender } = params;

  await program.methods
    .cancelLendOffer(offerId)
    .accounts({
      lender: lender.publicKey,
      lendOffer,
    })
    .signers([lender])
    .rpc()
};

export const systemCancelLendOffer = async (params: {
  offerId: string;
  tierId: string;
  lendAmount: number;
  waitingInterest: number;
  lendOffer: PublicKey;
  lender: PublicKey;
  lenderAtaAsset: PublicKey;
  systemKeypair: Keypair;
  systemAta: PublicKey;
  mintAsset: PublicKey;
  hotWalletKeypair: Keypair;
}): Promise<void> => {
  const {
    offerId,
    tierId,
    lendAmount,
    waitingInterest,
    lendOffer,
    lender,
    lenderAtaAsset,
    systemKeypair,
    systemAta,
    mintAsset,
    hotWalletKeypair,
  } = params;

  await program.methods
    .systemCancelLendOffer(
      offerId,
      tierId,
      new anchor.BN(waitingInterest)
    )
    .accounts({
      lender,
      lenderAtaAsset,
      lendOffer,
      system: systemKeypair.publicKey,
      systemAta,
      mintAsset,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([hotWalletKeypair])
    .rpc();
};

export const createLoanOfferNative = async (params: {
  offerId: string;
  lendOfferId: string;
  tierId: string;
  collateralAmount: number;
  borrower: Keypair;
  collateralMintAsset: PublicKey;
  collateralPriceFeedAccount: PublicKey;
  lender: PublicKey;
  lendMintAsset: PublicKey;
  lendOffer: PublicKey;
  lendPriceFeedAccount: PublicKey;
  loanOffer: PublicKey;
  settingAccount: PublicKey;
  interest: number;
}) => {
  const {
    offerId,
    collateralAmount,
    lendOfferId,
    tierId,
    borrower,
    collateralMintAsset,
    collateralPriceFeedAccount,
    lender,
    lendMintAsset,
    lendOffer,
    lendPriceFeedAccount,
    loanOffer,
    settingAccount,
    interest,
  } = params;

  await program.methods
    .createLoanOfferNative(
      offerId,
      lendOfferId,
      tierId,
      new anchor.BN(collateralAmount),
      interest
    )
    .accounts({
      borrower: borrower.publicKey,
      collateralMintAsset,
      collateralPriceFeedAccount,
      lender,
      lendMintAsset,
      lendOffer,
      lendPriceFeedAccount,
      loanOffer,
      settingAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([borrower])
    .rpc()
};

export const repayLoanOffer = async (params: {
  loanOfferId: string;
  borrower: Keypair;
  settingAccount: PublicKey;
  loanAtaAsset: PublicKey;
  hotWalletAta: PublicKey;
  loanOffer: PublicKey;
  mintAsset: PublicKey;
}) => {
  const {
    loanOfferId,
    borrower,
    settingAccount,
    loanAtaAsset,
    hotWalletAta,
    loanOffer,
    mintAsset,
  } = params;

  await program.methods
    .repayLoanOffer(loanOfferId)
    .accounts({
      borrower: borrower.publicKey,
      settingAccount,
      loanAtaAsset,
      hotWalletAta,
      loanOffer,
      mintAsset,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([borrower])
    .rpc()
};

export const systemUpdateLoanOffer = async (params: {
  offerId: string;
  tierId: string;
  borrowAmount: number;
  borrower: PublicKey;
  borrowerAtaAsset: PublicKey;
  systemKeypair: Keypair;
  systemAta: PublicKey;
  loanOffer: PublicKey;
  mintAsset: PublicKey;
  hotWalletKeypair: Keypair
}) => {
  const {
    offerId,
    tierId,
    borrowAmount,
    borrower,
    borrowerAtaAsset,
    systemKeypair,
    systemAta,
    loanOffer,
    mintAsset,
    hotWalletKeypair,
  } = params;

  await program.methods
    .systemUpdateLoanOffer(offerId, tierId, new anchor.BN(borrowAmount))
    .accounts({
      borrower,
      borrowerAtaAsset,
      system: systemKeypair.publicKey,
      systemAta,
      loanOffer,
      mintAsset,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([hotWalletKeypair])
    .rpc()
};

export const withdrawCollateral = async (params: {
  loanOfferId: string,
  withdrawAmount: number,
  borrower: Keypair,
  collateralMintAsset: PublicKey;
  collateralPriceFeedAccount: PublicKey;
  lendMintAsset: PublicKey;
  lendPriceFeedAccount: PublicKey;
  loanOffer: PublicKey;
  settingAccount: PublicKey;
}) => {
  const {
    loanOfferId,
    withdrawAmount,
    borrower,
    collateralMintAsset,
    collateralPriceFeedAccount, 
    lendMintAsset,
    lendPriceFeedAccount, 
    loanOffer, 
    settingAccount,
  } = params;


  await program.methods
    .withdrawCollateral(
      loanOfferId,
      new anchor.BN(withdrawAmount),
    )
    .accounts({
      borrower: borrower.publicKey,
      loanOffer,
      collateralMintAsset,
      collateralPriceFeedAccount,
      lendMintAsset,
      lendPriceFeedAccount,
      settingAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([borrower])
    .rpc()
}