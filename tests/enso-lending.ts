import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnsoLending } from "../target/types/enso_lending";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getOrCreateAssociatedTokenAccount,
  transfer,
  createMint,
} from "@solana/spl-token";

import { confirm, log, getAmountDifference, generateId } from "./utils";
import { assert } from "chai";
import {
  OPERATE_SYSTEM_SECRET_KEY,
  HOT_WALLET_SECRET_KEY,
} from "../accounts/dev";
import {
  cancelLendOffer,
  createLendOffer,
  createLoanOfferNative,
  editLendOffer,
  initAsset,
  initSettingAccount,
  repayLoanOffer,
  systemCancelLendOffer,
  systemUpdateLoanOffer,
  withdrawCollateral,
} from "./instruction";

xdescribe("enso-lending", () => {
  async function checkWalletBalance(tokenAccount: PublicKey): Promise<number> {
    let info = await provider.connection.getAccountInfo(tokenAccount);
    let amount = info.lamports;

    return amount;
  }

  // Set provider, connection and program
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  // @ts-ignore
  const providerWallet = provider.wallet.payer as Keypair;

  const connection = provider.connection;
  const program = anchor.workspace.EnsoLending as Program<EnsoLending>;

  // Boilerplate
  // Determine dummy token mints and token account address
  const [lender, usdcMint, wrappedSol, borrower] = Array.from(
    { length: 4 },
    () => Keypair.generate()
  );

  // Create account system to test on local network
  const ownerAccountSetting = Keypair.fromSecretKey(
    Uint8Array.from(OPERATE_SYSTEM_SECRET_KEY)
  );

  const hotWallet = Keypair.fromSecretKey(
    Uint8Array.from(HOT_WALLET_SECRET_KEY)
  );

  const usdcMintDecimal = 6;
  const totalUsdcSupply = 1e9 * 10 ** usdcMintDecimal; // 1000000000 USDC
  const wrappedSolDecimal = 9;
  const sol_usd_price_feed_id = "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix";
  const usdc_usd_price_feed_id = "5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7";

  const providerAtaUsdc = getAssociatedTokenAddressSync(
    usdcMint.publicKey,
    providerWallet.publicKey
  );

  xit("Airdrop and create mints", async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(connection);
    let tx = new Transaction();

    tx.instructions = [
      // Airdrop to ownerAccountSetting
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: ownerAccountSetting.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      }),

      // Airdrop to lender
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: lender.publicKey,
        lamports: 100 * LAMPORTS_PER_SOL,
      }),

      // Airdrop to borrower
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: borrower.publicKey,
        lamports: 100 * LAMPORTS_PER_SOL,
      }),

      // Airdrop to hot wallet
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: hotWallet.publicKey,
        lamports: 0.02 * LAMPORTS_PER_SOL,
      }),

      // create USDC token account
      ...[
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: usdcMint.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),

        createInitializeMint2Instruction(
          usdcMint.publicKey,
          usdcMintDecimal,
          provider.publicKey,
          null
        ),

        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          providerAtaUsdc,
          provider.publicKey,
          usdcMint.publicKey
        ),

        // mint 1 000 000 000 USDC
        createMintToInstruction(
          usdcMint.publicKey,
          providerAtaUsdc,
          providerWallet.publicKey,
          totalUsdcSupply
        ),
      ],

      // create Wrapped SOL
      ...[
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: wrappedSol.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),

        createInitializeMint2Instruction(
          wrappedSol.publicKey,
          wrappedSolDecimal,
          provider.publicKey,
          null
        ),
      ],
    ];

    await provider
      .sendAndConfirm(tx, [usdcMint, wrappedSol, providerWallet])
      .then((sig) => log(connection, sig));

    const providerUsdcBalance = await connection.getTokenAccountBalance(
      providerAtaUsdc
    );
    assert.equal(+providerUsdcBalance.value.amount, totalUsdcSupply);

    const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
      connection,
      providerWallet,
      usdcMint.publicKey,
      lender.publicKey
    );

    // transfer 1000 USDC to lender
    const usdcTransferToLender = 1000 * 10 ** usdcMintDecimal;
    await transfer(
      connection,
      providerWallet,
      providerAtaUsdc,
      lenderAtaUsdc.address,
      providerWallet,
      usdcTransferToLender
    );

    const borrowerAtaUsdc = await getOrCreateAssociatedTokenAccount(
      connection,
      providerWallet,
      usdcMint.publicKey,
      borrower.publicKey
    );

    // transfer 1000 USDC to borrower
    const usdcTransferToBorrower = 1000 * 10 ** usdcMintDecimal;
    await transfer(
      connection,
      providerWallet,
      providerAtaUsdc,
      borrowerAtaUsdc.address,
      providerWallet,
      usdcTransferToBorrower
    );

    const lenderUsdcBalance = await connection.getTokenAccountBalance(
      lenderAtaUsdc.address
    );
    assert.equal(+lenderUsdcBalance.value.amount, usdcTransferToLender);
  });

  // Util
  const airdrop = async (to: PublicKey): Promise<void> => {
    let tx = new Transaction();

    tx.instructions = [
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: to,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
    ];

    await provider.sendAndConfirm(tx, []).then((sig) => log(connection, sig));
  };

  xdescribe("account setting", () => {
    it("Init Account Setting successfully", async () => {
      const amount = 200 * usdcMintDecimal;
      const duration = 14;
      const tierId = "1234_tier_1";
      const lenderFeePercent = 0.01;
      const borrowerFeePercent = 0.01;

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
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting,
      });

      // Read data from PDA account
      const {
        amount: fetchedAmount,
        owner,
        receiver,
        tierId: fetchedTierId,
        duration: fetchDuration,
        lenderFeePercent: fetchedLenderFeePercent,
        borrowerFeePercent: fetchedBorrowerFeePercent,
      } = await program.account.settingAccount.fetch(settingAccount);
      assert.equal(fetchedTierId, tierId);
      assert.equal(amount, fetchedAmount.toNumber());
      assert.equal(fetchedLenderFeePercent, lenderFeePercent);
      assert.equal(fetchedBorrowerFeePercent, borrowerFeePercent);
      assert.equal(duration, fetchDuration.toNumber());
      assert.equal(ownerAccountSetting.publicKey.toString(), owner.toString());
      assert.equal(hotWallet.publicKey.toString(), receiver.toString());
    });

    it("Edit Account Setting", async () => {
      const amount = 200 * usdcMintDecimal;
      const duration = 14;
      const tierId = "1234_tier_1";
      const lenderFeePercent = 0.01;
      const borrowerFeePercent = 0.01;

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
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting,
      });

      const newAmount = 400;
      const newDuration = 28;
      const newLenderFeePercent = 0.02;
      const newBorrowerFeePercent = 0.03;

      await program.methods
        .editSettingAccount(
          tierId,
          new anchor.BN(newAmount),
          new anchor.BN(newDuration),
          newLenderFeePercent,
          newBorrowerFeePercent
        )
        .accounts({
          owner: ownerAccountSetting.publicKey,
          receiver: hotWallet.publicKey,
          settingAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerAccountSetting])
        .rpc({ skipPreflight: true })
        .then((sig) => confirm(connection, sig))
        .then((sig) => log(connection, sig));

      const {
        amount: fetchedNewAmount,
        owner: fetchedOwner,
        receiver: fetchedReceiver,
        tierId: fetchedTierId,
        duration: fetchedNewDuration,
        lenderFeePercent: fetchedNewLenderFeePercent,
        borrowerFeePercent: fetchedNewBorrowerFeePercent,
      } = await program.account.settingAccount.fetch(settingAccount);
      assert.equal(tierId, fetchedTierId);
      assert.equal(newAmount, fetchedNewAmount.toNumber());
      assert.equal(newLenderFeePercent, fetchedNewLenderFeePercent);
      assert.equal(newBorrowerFeePercent, fetchedNewBorrowerFeePercent);
      assert.equal(newDuration, fetchedNewDuration.toNumber());
      assert.equal(
        ownerAccountSetting.publicKey.toString(),
        fetchedOwner.toString()
      );
      assert.equal(hotWallet.publicKey.toString(), fetchedReceiver.toString());
    });

    it("Close Account Setting", async () => {
      const amount = 200 * usdcMintDecimal;
      const duration = 14;
      const tierId = "1234_tier_1";
      const lenderFeePercent = 0.01;
      const borrowerFeePercent = 0.01;
      const dataSize = 279; // Replace with the desired account size in bytes
      const expectedLoanRentReturned =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          dataSize
        );

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
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting,
      });

      const walletBalanceBeforeCloseLoan = await checkWalletBalance(
        ownerAccountSetting.publicKey
      );

      await program.methods
        .closeSettingAccount(tierId)
        .accounts({
          owner: ownerAccountSetting.publicKey,
          settingAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerAccountSetting])
        .rpc({ skipPreflight: true })
        .then((sig) => confirm(connection, sig))
        .then((sig) => log(connection, sig));

      const walletBalanceAfterCloseLoan = await checkWalletBalance(
        ownerAccountSetting.publicKey
      );

      const actualLoanRentReturned = getAmountDifference(
        walletBalanceBeforeCloseLoan,
        walletBalanceAfterCloseLoan
      );

      assert.equal(
        actualLoanRentReturned.toString(),
        expectedLoanRentReturned.toString()
      );

      // Setting account closed
      const checkSettingAccountInfo = await provider.connection.getAccountInfo(
        settingAccount
      );
      assert.equal(checkSettingAccountInfo, null);
    });
  });

  xdescribe("asset account", () => {
    it("Init asset account successfully", async () => {
      const seedAssetAccount = [
        Buffer.from("enso"),
        Buffer.from("asset"),
        usdcMint.publicKey.toBuffer(),
        program.programId.toBuffer(),
      ];

      console.log(
        "owner id>>>>>>>>>",
        ownerAccountSetting.publicKey.toString()
      );

      const assetAccount = PublicKey.findProgramAddressSync(
        seedAssetAccount,
        program.programId
      )[0];

      const priceFeedAccount = Keypair.generate();
      const priceFeedId = "USDC/USD";

      await initAsset({
        asset: assetAccount,
        isCollateral: false,
        isLend: true,
        maxPriceAgeSeconds: 60,
        name: "USDC",
        ownerKeypair: ownerAccountSetting,
        priceFeedAccount: priceFeedAccount.publicKey,
        priceFeedId,
        tokenMint: usdcMint.publicKey,
      });

      const data = await program.account.asset.fetch(assetAccount);
      console.log("🚀 ~ it ~ data:", data);
    });
  });

  xdescribe("lend offer", () => {
    describe("create lend offer", () => {
      it("create lend offer successfully", async () => {
        const amountTier = 50 * 10 ** usdcMintDecimal;
        const duration = 14;
        const tierId = `tier_id_${generateId(10)}`;
        const lenderFeePercent = 0.01;
        const borrowerFeePercent = 0.01;

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
          amount: amountTier,
          duration,
          tierId,
          lenderFeePercent,
          borrowerFeePercent,
          settingAccount,
          hotWallet: hotWallet.publicKey,
          ownerKeypair: ownerAccountSetting,
        });

        const offerId = `lend_offer_id_${generateId(10)}`;
        const interest = 2.1;

        const seedLendOffer = [
          Buffer.from("enso"),
          Buffer.from("lend_offer"),
          lender.publicKey.toBuffer(),
          Buffer.from(offerId),
          program.programId.toBuffer(),
        ];

        const lendOfferAccount = PublicKey.findProgramAddressSync(
          seedLendOffer,
          program.programId
        )[0];

        const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          hotWallet.publicKey
        );

        const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          lender.publicKey
        );

        const lenderUsdcBalanceBefore = +(
          await connection.getTokenAccountBalance(lenderAtaUsdc.address)
        ).value.amount;

        await createLendOffer({
          hotWalletAta: hotWalletUsdcAta.address,
          lender,
          lenderAtaAsset: lenderAtaUsdc.address,
          lendOffer: lendOfferAccount,
          mintAsset: usdcMint.publicKey,
          settingAccount,
          interest,
          offerId,
          tierId,
        });

        const lenderUsdcBalanceAfter = +(
          await connection.getTokenAccountBalance(lenderAtaUsdc.address)
        ).value.amount;
        assert.equal(
          +lenderUsdcBalanceAfter,
          lenderUsdcBalanceBefore - amountTier
        );

        const hotWalletUsdcBalance = +(
          await connection.getTokenAccountBalance(hotWalletUsdcAta.address)
        ).value.amount;
        assert.equal(+hotWalletUsdcBalance, amountTier);

        const {
          amount,
          duration: fetchedDuration,
          interest: fetchedInterest,
          lenderFeePercent: fetchedLenderFee,
          lender: fetchedLender,
          lendMintToken,
          offerId: fetchedOfferId,
        } = await program.account.lendOfferAccount.fetch(lendOfferAccount);

        assert.equal(amount.toNumber(), amountTier);
        assert.equal(fetchedDuration.toNumber(), duration);
        assert.equal(fetchedLenderFee, fetchedLenderFee);
        assert.equal(fetchedInterest, interest);
        assert.equal(fetchedLender.toString(), lender.publicKey.toString());
        assert.equal(lendMintToken.toString(), usdcMint.publicKey.toString());
        assert.equal(fetchedOfferId, offerId);
      });

      it("should throw an error if interest is not greater than zero", async () => {
        try {
          const amountTier = 50 * 10 ** usdcMintDecimal;
          const duration = 14;
          const tierId = `tier_id_${generateId(10)}`;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting,
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 0;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "Interest must be greater than 0"
          );
        }
      });

      it("Should throw error if create lend offer account that setting account had not initialized", async () => {
        try {
          const tierId = `tier_id_${generateId(10)}`;

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

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "The program expected this account to be already initialized"
          );
        }
      });

      it("Should throw error if lender did not have enough token", async () => {
        try {
          const amountTier = 200 * 10 ** usdcMintDecimal;
          const duration = 14;
          const tierId = `tier_id_${generateId(10)}`;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting,
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "Lender does not have enough assets"
          );
        }
      });

      it("should throw error if lender provide loan mint asset that different lend mint asset in setting account", async () => {
        // create different SPL token
        const newSplToken = await createMint(
          connection,
          providerWallet,
          provider.publicKey,
          provider.publicKey,
          6
        );

        try {
          const tierId = `tier_id_${generateId(10)}`;
          const amountTier = 50 * 10 ** usdcMintDecimal;
          const duration = 14;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
          const sol_usd_price_feed = new PublicKey(sol_usd_price_feed_id);
          const usdc_usd_price_feed = new PublicKey(usdc_usd_price_feed_id);

          await initSettingAccount({
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting,
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaNewSplToken = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            newSplToken,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaNewSplToken.address,
            lendOffer: lendOfferAccount,
            mintAsset: newSplToken,
            settingAccount,
            interest,
            offerId,
            tierId,
          });
        } catch (error) {
          assert.equal(error.error.errorMessage, "Invalid mint asset");
        }
      });
    });

    describe("edit lend offer", () => {
      it("Edit lend offer successfully", async () => {
        const amountTier = 10 * 10 ** usdcMintDecimal;
        const duration = 14;
        const tierId = `tier_id_${generateId(10)}`;
        const lenderFeePercent = 0.01;
        const borrowerFeePercent = 0.01;

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
          amount: amountTier,
          duration,
          tierId,
          lenderFeePercent,
          borrowerFeePercent,
          settingAccount,
          hotWallet: hotWallet.publicKey,
          ownerKeypair: ownerAccountSetting,
        });

        const offerId = `lend_offer_id_${generateId(10)}`;
        const interest = 2.1;

        const seedLendOffer = [
          Buffer.from("enso"),
          Buffer.from("lend_offer"),
          lender.publicKey.toBuffer(),
          Buffer.from(offerId),
          program.programId.toBuffer(),
        ];

        const lendOfferAccount = PublicKey.findProgramAddressSync(
          seedLendOffer,
          program.programId
        )[0];

        const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          hotWallet.publicKey
        );

        const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          lender.publicKey
        );

        await createLendOffer({
          hotWalletAta: hotWalletUsdcAta.address,
          lender,
          lenderAtaAsset: lenderAtaUsdc.address,
          lendOffer: lendOfferAccount,
          mintAsset: usdcMint.publicKey,
          settingAccount,
          interest,
          offerId,
          tierId,
        });

        const newInterest = 5;

        await editLendOffer({
          offerId,
          interest: newInterest,
          lender,
          lendOffer: lendOfferAccount,
        });

        const { interest: fetchedInterest } =
          await program.account.lendOfferAccount.fetch(lendOfferAccount);

        assert.equal(newInterest, fetchedInterest);
      });

      it("Should throw error if lender edit lend offer that not belong to them", async () => {
        const newLender = Keypair.generate();

        // air drop sol to new lender
        await airdrop(newLender.publicKey);

        try {
          const amountTier = 10 * 10 ** usdcMintDecimal;
          const duration = 14;
          const tierId = `tier_id_${generateId(10)}`;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting,
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });

          const newInterest = 5;

          await editLendOffer({
            offerId,
            interest: newInterest,
            lender: newLender,
            lendOffer: lendOfferAccount,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "A seeds constraint was violated"
          );
        }
      });

      it("Should throw an error if lender update interest is not greater than 0", async () => {
        try {
          const amountTier = 10 * 10 ** usdcMintDecimal;
          const duration = 14;
          const tierId = `tier_id_${generateId(10)}`;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });

          const newInterest = -1;

          await editLendOffer({
            offerId,
            interest: newInterest,
            lender,
            lendOffer: lendOfferAccount,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "Interest must be greater than 0"
          );
        }
      });
    });

    describe("cancel lend offer", () => {
      it("lender should cancel the lend offer and system transfer back enough lend amount successfully", async () => {
        const amountTier = 10 * 10 ** usdcMintDecimal;
        const duration = 1209600; //14 days
        const tierId = `tier_id_${generateId(10)}`;
        const lenderFeePercent = 0;
        const borrowerFeePercent = 0;
        const interest = 2.1;

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
          amount: amountTier,
          duration,
          tierId,
          lenderFeePercent,
          borrowerFeePercent,
          settingAccount,
          hotWallet: hotWallet.publicKey,
          ownerKeypair: ownerAccountSetting
        });

        const offerId = `lend_offer_id_${generateId(10)}`;

        const seedLendOffer = [
          Buffer.from("enso"),
          Buffer.from("lend_offer"),
          lender.publicKey.toBuffer(),
          Buffer.from(offerId),
          program.programId.toBuffer(),
        ];

        const lendOfferAccount = PublicKey.findProgramAddressSync(
          seedLendOffer,
          program.programId
        )[0];

        const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          hotWallet.publicKey
        );

        const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
          connection,
          providerWallet,
          usdcMint.publicKey,
          lender.publicKey
        );

        const beforeUSDCBalanceLender = await connection.getTokenAccountBalance(
          lenderAtaUsdc.address
        );
        const beforeUSDCBalanceHotWallet =
          await connection.getTokenAccountBalance(hotWalletUsdcAta.address);

        await createLendOffer({
          hotWalletAta: hotWalletUsdcAta.address,
          lender,
          lenderAtaAsset: lenderAtaUsdc.address,
          lendOffer: lendOfferAccount,
          mintAsset: usdcMint.publicKey,
          settingAccount,
          interest,
          offerId,
          tierId,
        });

        const { status: prevStatus } =
          await program.account.lendOfferAccount.fetch(lendOfferAccount);

        assert.equal(prevStatus.hasOwnProperty("created"), true);

        // Lender Cancel lend offer
        await cancelLendOffer({
          lender,
          lendOffer: lendOfferAccount,
          offerId,
        });

        const { status: currentStatus } =
          await program.account.lendOfferAccount.fetch(lendOfferAccount);

        assert.equal(currentStatus.hasOwnProperty("canceling"), true);

        // System transfer lend asset back to lender
        await systemCancelLendOffer({
          systemKeypair: hotWallet,
          systemAta: hotWalletUsdcAta.address,
          lendAmount: amountTier,
          waitingInterest: 0, // assume waiting interest is 0
          lender: lender.publicKey,
          lenderAtaAsset: lenderAtaUsdc.address,
          lendOffer: lendOfferAccount,
          mintAsset: usdcMint.publicKey,
          offerId,
          tierId,
          hotWalletKeypair: hotWallet,
        });

        const { status: afterSystemCancelLendOfferStatus } =
          await program.account.lendOfferAccount.fetch(lendOfferAccount);

        const afterUSDCBalanceLender = await connection.getTokenAccountBalance(
          lenderAtaUsdc.address
        );
        const afterUSDCBalanceHotWallet =
          await connection.getTokenAccountBalance(hotWalletUsdcAta.address);

        assert.equal(
          afterSystemCancelLendOfferStatus.hasOwnProperty("canceled"),
          true
        );
        assert.equal(
          afterUSDCBalanceLender.value.amount,
          beforeUSDCBalanceLender.value.amount
        );
        assert.equal(
          afterUSDCBalanceHotWallet.value.amount,
          beforeUSDCBalanceHotWallet.value.amount
        );
      });

      it("Should throw error if lender close lend offer that not belong to them", async () => {
        const newLender = Keypair.generate();

        // air drop sol to new lender
        await airdrop(newLender.publicKey);

        try {
          const amountTier = 10 * 10 ** usdcMintDecimal;
          const duration = 14;
          const tierId = `tier_id_${generateId(10)}`;
          const lenderFeePercent = 0.01;
          const borrowerFeePercent = 0.01;

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
            amount: amountTier,
            duration,
            tierId,
            lenderFeePercent,
            borrowerFeePercent,
            settingAccount,
            hotWallet: hotWallet.publicKey,
            ownerKeypair: ownerAccountSetting
          });

          const offerId = `lend_offer_id_${generateId(10)}`;
          const interest = 2.1;

          const seedLendOffer = [
            Buffer.from("enso"),
            Buffer.from("lend_offer"),
            lender.publicKey.toBuffer(),
            Buffer.from(offerId),
            program.programId.toBuffer(),
          ];

          const lendOfferAccount = PublicKey.findProgramAddressSync(
            seedLendOffer,
            program.programId
          )[0];

          const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            hotWallet.publicKey
          );

          const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
            connection,
            providerWallet,
            usdcMint.publicKey,
            lender.publicKey
          );

          await createLendOffer({
            hotWalletAta: hotWalletUsdcAta.address,
            lender,
            lenderAtaAsset: lenderAtaUsdc.address,
            lendOffer: lendOfferAccount,
            mintAsset: usdcMint.publicKey,
            settingAccount,
            interest,
            offerId,
            tierId,
          });

          await cancelLendOffer({
            lender,
            lendOffer: lendOfferAccount,
            offerId,
          });
        } catch (error) {
          assert.equal(
            error.error.errorMessage,
            "A seeds constraint was violated"
          );
        }
      });
    });
  });

  xdescribe("create loan offer native", () => {
    // NOTE: To run this test, go to the context create_loan_offer_native and comment validation health ratio
    it("create loan offer successfully", async () => {
      const amountTier = 50 * 10 ** usdcMintDecimal;
      const collateralAmount = 10 * 10 ** wrappedSolDecimal;
      const duration = 14;
      const tierId = `tier_id_${generateId(10)}`;
      const lenderFeePercent = 0;
      const borrowerFeePercent = 0;

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

      const sol_usd_price_feed = new PublicKey(sol_usd_price_feed_id);
      const usdc_usd_price_feed = new PublicKey(usdc_usd_price_feed_id);

      await initSettingAccount({
        amount: amountTier,
        duration,
        tierId,
        lenderFeePercent,
        borrowerFeePercent,
        settingAccount,
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting
      });

      const lendOfferId = `lend_offer_id_${generateId(10)}`;
      const loanOfferId = `lend_offer_id_${generateId(10)}`;

      const interest = 2.1;

      const seedLendOffer = [
        Buffer.from("enso"),
        Buffer.from("lend_offer"),
        lender.publicKey.toBuffer(),
        Buffer.from(lendOfferId),
        program.programId.toBuffer(),
      ];

      const lendOfferAccount = PublicKey.findProgramAddressSync(
        seedLendOffer,
        program.programId
      )[0];

      const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        hotWallet.publicKey
      );

      const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        lender.publicKey
      );

      await createLendOffer({
        hotWalletAta: hotWalletUsdcAta.address,
        lender,
        lenderAtaAsset: lenderAtaUsdc.address,
        lendOffer: lendOfferAccount,
        mintAsset: usdcMint.publicKey,
        settingAccount,
        interest,
        offerId: lendOfferId,
        tierId,
      });

      const seedLoanOffer = [
        Buffer.from("enso"),
        Buffer.from("loan_offer"),
        borrower.publicKey.toBuffer(),
        Buffer.from(loanOfferId),
        program.programId.toBuffer(),
      ];

      const loanOfferAccount = PublicKey.findProgramAddressSync(
        seedLoanOffer,
        program.programId
      )[0];

      await createLoanOfferNative({
        borrower,
        collateralAmount,
        settingAccount,
        lender: lender.publicKey,
        lendPriceFeedAccount: usdc_usd_price_feed,
        collateralPriceFeedAccount: sol_usd_price_feed,
        lendOffer: lendOfferAccount,
        loanOffer: loanOfferAccount,
        lendMintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        lendOfferId,
        tierId,
        collateralMintAsset: wrappedSol.publicKey,
        interest,
      });

      const balanceLoanOfferPda = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        "🚀 ~ it ~ balanceLoanOfferPda:",
        balanceLoanOfferPda / 10 ** wrappedSolDecimal
      );

      assert.isTrue(
        balanceLoanOfferPda >= collateralAmount,
        "balance of pda need to greater or equal collateral deposit"
      );
    });
  });

  xdescribe("repay loan offer", () => {
    it("repay loan offer successfully", async () => {
      const amountTier = 200 * 10 ** usdcMintDecimal; // 200 USDC
      const collateralAmount = 10 * 10 ** wrappedSolDecimal; // 10 SOL
      const duration = 14 * 24 * 60 * 60;
      const tierId = `tier_id_${generateId(10)}`;
      const lenderFeePercent = 0;
      const borrowerFeePercent = 0;

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

      const sol_usd_price_feed = new PublicKey(sol_usd_price_feed_id);
      const usdc_usd_price_feed = new PublicKey(usdc_usd_price_feed_id);

      await initSettingAccount({
        amount: amountTier,
        duration,
        tierId,
        lenderFeePercent,
        borrowerFeePercent,
        settingAccount,
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting
      });

      const lendOfferId = `lend_offer_id_${generateId(10)}`;
      const loanOfferId = `lend_offer_id_${generateId(10)}`;

      const interest = 4.4;

      const seedLendOffer = [
        Buffer.from("enso"),
        Buffer.from("lend_offer"),
        lender.publicKey.toBuffer(),
        Buffer.from(lendOfferId),
        program.programId.toBuffer(),
      ];

      const lendOfferAccount = PublicKey.findProgramAddressSync(
        seedLendOffer,
        program.programId
      )[0];

      const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        hotWallet.publicKey
      );

      const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        lender.publicKey
      );

      const borrowerAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        borrower.publicKey
      );

      await createLendOffer({
        hotWalletAta: hotWalletUsdcAta.address,
        lender,
        lenderAtaAsset: lenderAtaUsdc.address,
        lendOffer: lendOfferAccount,
        mintAsset: usdcMint.publicKey,
        settingAccount,
        interest,
        offerId: lendOfferId,
        tierId,
      });

      const seedLoanOffer = [
        Buffer.from("enso"),
        Buffer.from("loan_offer"),
        borrower.publicKey.toBuffer(),
        Buffer.from(loanOfferId),
        program.programId.toBuffer(),
      ];

      const loanOfferAccount = PublicKey.findProgramAddressSync(
        seedLoanOffer,
        program.programId
      )[0];

      const balanceLoanOfferPdaBeforeCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaBeforeCreateLoan: ${
          balanceLoanOfferPdaBeforeCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      const loanOfferDataSize = 439;
      const loanOfferRentLamports =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          loanOfferDataSize
        );

      await createLoanOfferNative({
        borrower,
        collateralAmount,
        settingAccount,
        lender: lender.publicKey,
        lendPriceFeedAccount: usdc_usd_price_feed,
        collateralPriceFeedAccount: sol_usd_price_feed,
        lendOffer: lendOfferAccount,
        loanOffer: loanOfferAccount,
        lendMintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        lendOfferId,
        tierId,
        collateralMintAsset: wrappedSol.publicKey,
        interest,
      });

      const balanceLoanOfferPdaAfterCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaAfterCreateLoan: ${
          balanceLoanOfferPdaAfterCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      assert.equal(
        collateralAmount,
        balanceLoanOfferPdaAfterCreateLoan -
          loanOfferRentLamports -
          balanceLoanOfferPdaBeforeCreateLoan
      );

      const borrowerUsdcAmountBeforeReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountBeforeReceiveLendAsset: ${
          borrowerUsdcAmountBeforeReceiveLendAsset / 10 ** usdcMintDecimal
        } USDC`
      );

      await systemUpdateLoanOffer({
        borrowAmount: amountTier,
        borrower: borrower.publicKey,
        borrowerAtaAsset: borrowerAtaUsdc.address,
        systemKeypair: hotWallet,
        systemAta: hotWalletUsdcAta.address,
        loanOffer: loanOfferAccount,
        mintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        tierId,
        hotWalletKeypair: hotWallet,
      });

      const { status: loanOfferStatusAfterSystemTransferLendAsset } =
        await program.account.loanOfferAccount.fetch(loanOfferAccount);

      console.log(
        "🚀 ~ it ~ loanOfferStatusAfterSystemTransferLendAsset:",
        loanOfferStatusAfterSystemTransferLendAsset
      );
      assert.isTrue(
        loanOfferStatusAfterSystemTransferLendAsset.hasOwnProperty(
          "fundTransferred"
        )
      );

      const borrowerUsdcAmountAfterReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountAfterReceiveLendAsset: ${
          borrowerUsdcAmountAfterReceiveLendAsset / 10 ** usdcMintDecimal
        } SOL`
      );

      assert.equal(
        amountTier,
        borrowerUsdcAmountAfterReceiveLendAsset -
          borrowerUsdcAmountBeforeReceiveLendAsset
      );

      const balanceLoanOfferPdaBeforeRepay = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaBeforeRepay: ${
          balanceLoanOfferPdaBeforeRepay / 10 ** wrappedSolDecimal
        } SOL`
      );

      await repayLoanOffer({
        borrower,
        hotWalletAta: hotWalletUsdcAta.address,
        loanAtaAsset: borrowerAtaUsdc.address,
        mintAsset: usdcMint.publicKey,
        loanOffer: loanOfferAccount,
        loanOfferId,
        settingAccount,
      });

      const { status } = await program.account.loanOfferAccount.fetch(
        loanOfferAccount
      );
      console.log("🚀 ~ it ~ status:", status);
      assert.isTrue(status.hasOwnProperty("borrowerPaid"));

      const balanceLoanOfferPdaAfterRepay = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaAfterRepay: ${
          balanceLoanOfferPdaAfterRepay / 10 ** wrappedSolDecimal
        } SOL`
      );
      assert.equal(
        collateralAmount,
        balanceLoanOfferPdaBeforeRepay - balanceLoanOfferPdaAfterRepay
      );

      const balanceSOLBorrowerAfterRepay = await connection.getBalance(
        borrower.publicKey
      );
      console.log(
        `🚀 ~ it ~ balanceSOLBorrowerAfterRepay: ${
          balanceSOLBorrowerAfterRepay / 10 ** wrappedSolDecimal
        } SOL`
      );
    });
  });

  xdescribe("Withdraw collateral", () => {
    it("withdraw collateral success", async () => {
      const amountTier = 50 * 10 ** usdcMintDecimal;
      const collateralAmount = 10 * 10 ** wrappedSolDecimal;
      const duration = 14;
      const tierId = `tier_id_${generateId(10)}`;
      const lenderFeePercent = 0;
      const borrowerFeePercent = 0;

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

      const sol_usd_price_feed = new PublicKey(sol_usd_price_feed_id);
      const usdc_usd_price_feed = new PublicKey(usdc_usd_price_feed_id);

      await initSettingAccount({
        amount: amountTier,
        duration,
        tierId,
        lenderFeePercent,
        borrowerFeePercent,
        settingAccount,
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting
      });

      const lendOfferId = `lend_offer_id_${generateId(10)}`;
      const loanOfferId = `lend_offer_id_${generateId(10)}`;

      const interest = 2.1;

      const seedLendOffer = [
        Buffer.from("enso"),
        Buffer.from("lend_offer"),
        lender.publicKey.toBuffer(),
        Buffer.from(lendOfferId),
        program.programId.toBuffer(),
      ];

      const lendOfferAccount = PublicKey.findProgramAddressSync(
        seedLendOffer,
        program.programId
      )[0];

      const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        hotWallet.publicKey
      );

      const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        lender.publicKey
      );

      const borrowerAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        borrower.publicKey
      );

      await createLendOffer({
        hotWalletAta: hotWalletUsdcAta.address,
        lender,
        lenderAtaAsset: lenderAtaUsdc.address,
        lendOffer: lendOfferAccount,
        mintAsset: usdcMint.publicKey,
        settingAccount,
        interest,
        offerId: lendOfferId,
        tierId,
      });

      const seedLoanOffer = [
        Buffer.from("enso"),
        Buffer.from("loan_offer"),
        borrower.publicKey.toBuffer(),
        Buffer.from(loanOfferId),
        program.programId.toBuffer(),
      ];

      const loanOfferAccount = PublicKey.findProgramAddressSync(
        seedLoanOffer,
        program.programId
      )[0];

      const balanceLoanOfferPdaBeforeCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaBeforeCreateLoan: ${
          balanceLoanOfferPdaBeforeCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      const loanOfferDataSize = 439;
      const loanOfferRentLamports =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          loanOfferDataSize
        );

      await createLoanOfferNative({
        borrower,
        collateralAmount,
        settingAccount,
        lender: lender.publicKey,
        lendPriceFeedAccount: usdc_usd_price_feed,
        collateralPriceFeedAccount: sol_usd_price_feed,
        lendOffer: lendOfferAccount,
        loanOffer: loanOfferAccount,
        lendMintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        lendOfferId,
        tierId,
        collateralMintAsset: wrappedSol.publicKey,
        interest,
      });

      const balanceLoanOfferPdaAfterCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaAfterCreateLoan: ${
          balanceLoanOfferPdaAfterCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      assert.equal(
        collateralAmount,
        balanceLoanOfferPdaAfterCreateLoan -
          loanOfferRentLamports -
          balanceLoanOfferPdaBeforeCreateLoan
      );

      const borrowerUsdcAmountBeforeReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountBeforeReceiveLendAsset: ${
          borrowerUsdcAmountBeforeReceiveLendAsset / 10 ** usdcMintDecimal
        } USDC`
      );

      await systemUpdateLoanOffer({
        borrowAmount: amountTier,
        borrower: borrower.publicKey,
        borrowerAtaAsset: borrowerAtaUsdc.address,
        systemKeypair: hotWallet,
        systemAta: hotWalletUsdcAta.address,
        loanOffer: loanOfferAccount,
        mintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        tierId,
        hotWalletKeypair: hotWallet,
      });

      const { status: loanOfferStatusAfterSystemTransferLendAsset } =
        await program.account.loanOfferAccount.fetch(loanOfferAccount);

      console.log(
        "🚀 ~ it ~ loanOfferStatusAfterSystemTransferLendAsset:",
        loanOfferStatusAfterSystemTransferLendAsset
      );
      assert.isTrue(
        loanOfferStatusAfterSystemTransferLendAsset.hasOwnProperty(
          "fundTransferred"
        )
      );

      const borrowerUsdcAmountAfterReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountAfterReceiveLendAsset: ${
          borrowerUsdcAmountAfterReceiveLendAsset / 10 ** usdcMintDecimal
        } USDC`
      );

      assert.equal(
        amountTier,
        borrowerUsdcAmountAfterReceiveLendAsset -
          borrowerUsdcAmountBeforeReceiveLendAsset
      );

      const borrowerSolBalanceBeforeWithdraw = await connection.getBalance(
        borrower.publicKey
      );
      console.log(
        `🚀 ~ it ~ borrowerSolBalanceBeforeWithdraw: ${
          borrowerSolBalanceBeforeWithdraw / 10 ** wrappedSolDecimal
        } SOL`
      );
      const loanOfferCollateralBeforeWithdraw = await connection.getBalance(
        loanOfferAccount
      );
      console.log(
        `🚀 ~ it ~ loanOfferCollateralBeforeWithdraw: ${
          loanOfferCollateralBeforeWithdraw / 10 ** wrappedSolDecimal
        } SOL`
      );

      const withdrawAmount = 2 * 10 ** wrappedSolDecimal; // 2 SOL

      await withdrawCollateral({
        borrower,
        collateralMintAsset: wrappedSol.publicKey,
        collateralPriceFeedAccount: sol_usd_price_feed,
        lendMintAsset: usdcMint.publicKey,
        lendPriceFeedAccount: usdc_usd_price_feed,
        loanOffer: loanOfferAccount,
        loanOfferId,
        settingAccount,
        withdrawAmount,
      });

      const borrowerSolBalanceAfterWithdraw = await connection.getBalance(
        borrower.publicKey
      );
      console.log(
        `🚀 ~ it ~ borrowerSolBalanceAfterWithdraw: ${
          borrowerSolBalanceAfterWithdraw / 10 ** wrappedSolDecimal
        } SOL`
      );
      const loanOfferCollateralAfterWithdraw = await connection.getBalance(
        loanOfferAccount
      );
      console.log(
        `🚀 ~ it ~ loanOfferCollateralAfterWithdraw: ${
          loanOfferCollateralAfterWithdraw / 10 ** wrappedSolDecimal
        } SOL`
      );
    });
  });

  xdescribe("liquidate loan offer", () => {
    it("liquidate loan offer successfully", async () => {
      const amountTier = 50 * 10 ** usdcMintDecimal;
      const collateralAmount = 10 * 10 ** wrappedSolDecimal;
      const duration = 14;
      const tierId = `tier_id_${generateId(10)}`;
      const lenderFeePercent = 0;
      const borrowerFeePercent = 0;

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

      const sol_usd_price_feed = new PublicKey(sol_usd_price_feed_id);
      const usdc_usd_price_feed = new PublicKey(usdc_usd_price_feed_id);

      await initSettingAccount({
        amount: amountTier,
        duration,
        tierId,
        lenderFeePercent,
        borrowerFeePercent,
        settingAccount,
        hotWallet: hotWallet.publicKey,
        ownerKeypair: ownerAccountSetting
      });

      const lendOfferId = `lend_offer_id_${generateId(10)}`;
      const loanOfferId = `lend_offer_id_${generateId(10)}`;

      const interest = 2.1;

      const seedLendOffer = [
        Buffer.from("enso"),
        Buffer.from("lend_offer"),
        lender.publicKey.toBuffer(),
        Buffer.from(lendOfferId),
        program.programId.toBuffer(),
      ];

      const lendOfferAccount = PublicKey.findProgramAddressSync(
        seedLendOffer,
        program.programId
      )[0];

      const hotWalletUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        hotWallet.publicKey
      );

      const lenderAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        lender.publicKey
      );

      const borrowerAtaUsdc = await getOrCreateAssociatedTokenAccount(
        connection,
        providerWallet,
        usdcMint.publicKey,
        borrower.publicKey
      );

      await createLendOffer({
        hotWalletAta: hotWalletUsdcAta.address,
        lender,
        lenderAtaAsset: lenderAtaUsdc.address,
        lendOffer: lendOfferAccount,
        mintAsset: usdcMint.publicKey,
        settingAccount,
        interest,
        offerId: lendOfferId,
        tierId,
      });

      const seedLoanOffer = [
        Buffer.from("enso"),
        Buffer.from("loan_offer"),
        borrower.publicKey.toBuffer(),
        Buffer.from(loanOfferId),
        program.programId.toBuffer(),
      ];

      const loanOfferAccount = PublicKey.findProgramAddressSync(
        seedLoanOffer,
        program.programId
      )[0];

      const balanceLoanOfferPdaBeforeCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaBeforeCreateLoan: ${
          balanceLoanOfferPdaBeforeCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      const loanOfferDataSize = 439;
      const loanOfferRentLamports =
        await program.provider.connection.getMinimumBalanceForRentExemption(
          loanOfferDataSize
        );

      await createLoanOfferNative({
        borrower,
        collateralAmount,
        settingAccount,
        lender: lender.publicKey,
        lendPriceFeedAccount: usdc_usd_price_feed,
        collateralPriceFeedAccount: sol_usd_price_feed,
        lendOffer: lendOfferAccount,
        loanOffer: loanOfferAccount,
        lendMintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        lendOfferId,
        tierId,
        collateralMintAsset: wrappedSol.publicKey,
        interest,
      });

      const balanceLoanOfferPdaAfterCreateLoan = +(await connection.getBalance(
        loanOfferAccount
      ));
      console.log(
        `🚀 ~ it ~ balanceLoanOfferPdaAfterCreateLoan: ${
          balanceLoanOfferPdaAfterCreateLoan / 10 ** wrappedSolDecimal
        } SOL`
      );

      assert.equal(
        collateralAmount,
        balanceLoanOfferPdaAfterCreateLoan -
          loanOfferRentLamports -
          balanceLoanOfferPdaBeforeCreateLoan
      );

      const borrowerUsdcAmountBeforeReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountBeforeReceiveLendAsset: ${
          borrowerUsdcAmountBeforeReceiveLendAsset / 10 ** usdcMintDecimal
        } USDC`
      );

      await systemUpdateLoanOffer({
        borrowAmount: amountTier,
        borrower: borrower.publicKey,
        borrowerAtaAsset: borrowerAtaUsdc.address,
        systemKeypair: hotWallet,
        systemAta: hotWalletUsdcAta.address,
        loanOffer: loanOfferAccount,
        mintAsset: usdcMint.publicKey,
        offerId: loanOfferId,
        tierId,
        hotWalletKeypair: hotWallet,
      });

      const { status: loanOfferStatusAfterSystemTransferLendAsset } =
        await program.account.loanOfferAccount.fetch(loanOfferAccount);

      console.log(
        "🚀 ~ it ~ loanOfferStatusAfterSystemTransferLendAsset:",
        loanOfferStatusAfterSystemTransferLendAsset
      );
      assert.isTrue(
        loanOfferStatusAfterSystemTransferLendAsset.hasOwnProperty(
          "fundTransferred"
        )
      );

      const borrowerUsdcAmountAfterReceiveLendAsset = +(
        await connection.getTokenAccountBalance(borrowerAtaUsdc.address)
      ).value.amount;
      console.log(
        `🚀 ~ it ~ borrowerUsdcAmountAfterReceiveLendAsset: ${
          borrowerUsdcAmountAfterReceiveLendAsset / 10 ** usdcMintDecimal
        } USDC`
      );

      assert.equal(
        amountTier,
        borrowerUsdcAmountAfterReceiveLendAsset -
          borrowerUsdcAmountBeforeReceiveLendAsset
      );

      const hotWalletBalanceBeforeLiquidate = await connection.getBalance(
        hotWallet.publicKey
      );
      console.log(
        `🚀 ~ it ~ hotWalletBalanceBeforeLiquidate: ${
          hotWalletBalanceBeforeLiquidate / 10 ** wrappedSolDecimal
        } SOL`
      );

      // TODO: Update new instruction liquidate

      const hotWalletBalanceAfterLiquidate = await connection.getBalance(
        hotWallet.publicKey
      );
      console.log(
        `🚀 ~ it ~ hotWalletBalanceAfterLiquidate: ${
          hotWalletBalanceAfterLiquidate / 10 ** wrappedSolDecimal
        } SOL`
      );

      const { status } = await program.account.loanOfferAccount.fetch(
        loanOfferAccount
      );

      assert.equal(
        collateralAmount,
        hotWalletBalanceAfterLiquidate - hotWalletBalanceBeforeLiquidate
      );
      assert.isTrue(status.hasOwnProperty("liquidating"));
    });
  });
});
