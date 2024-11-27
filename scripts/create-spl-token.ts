import {
  createAccount,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import * as dotenv from "dotenv";

dotenv.config();

const WALLET_OWNER_SPL_TOKEN = process.env.WALLET_OWNER_SPL_TOKEN.split(
  ","
).map((val) => parseInt(val));

const ownerSPLTokenWallet = Keypair.fromSecretKey(
  Uint8Array.from(WALLET_OWNER_SPL_TOKEN)
);

const main = async (
  name: string,
  symbol: string,
  uri: string,
  decimals: number,
  totalSupply: number
) => {
  const connection = new Connection(clusterApiUrl("devnet"));

  const tokenMintKeypair = Keypair.generate();
  const tokenMint = await createMint(
    connection,
    ownerSPLTokenWallet,
    ownerSPLTokenWallet.publicKey,
    null,
    decimals,
    tokenMintKeypair
  );
  console.log(
    `🚀 ~ Create token ${name} mint: ${tokenMintKeypair.publicKey.toString()}`
  );

  const tokenAccount = await createAccount(
    connection,
    ownerSPLTokenWallet,
    tokenMint,
    ownerSPLTokenWallet.publicKey,
    null,
    null,
    TOKEN_PROGRAM_ID
  );
  // const tokenAccount = new PublicKey(
  //   "EDewgd1hQVaAGYrUSMbuXbjudbgKqKDKsUjibVAaTXrL"
  // );
  console.log("🚀 ~ main ~ tokenAccount:", tokenAccount.toString());

  const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    ownerSPLTokenWallet,
    tokenMint,
    ownerSPLTokenWallet.publicKey
  );
  console.log(
    "🚀 ~ main ~ associatedTokenAccount:",
    associatedTokenAccount.toString()
  );

  await mintTo(
    connection,
    ownerSPLTokenWallet,
    tokenMint,
    associatedTokenAccount.address,
    ownerSPLTokenWallet.publicKey,
    totalSupply
  );

  console.log(
    `🚀 ~ Successfully issue ${totalSupply.toString()} token ${name}`
  );

  const metadataPDA = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintKeypair.publicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];

  const tx = new Transaction();
  tx.instructions = [
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: tokenMint,
        mintAuthority: ownerSPLTokenWallet.publicKey,
        payer: ownerSPLTokenWallet.publicKey,
        updateAuthority: ownerSPLTokenWallet.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          collectionDetails: null,
          isMutable: true,
          data: {
            collection: null,
            creators: null,
            name,
            sellerFeeBasisPoints: 0,
            symbol,
            uri,
            uses: null,
          },
        },
      }
    ),
  ];

  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerSPLTokenWallet.publicKey;

  await sendAndConfirmTransaction(connection, tx, [
    tokenMintKeypair,
    ownerSPLTokenWallet,
  ]);

  console.log(`✅ Successfully created token metadata`);
};

const name = "bonkSOL";
const symbol = "BONK";
const decimals = 5;
const totalSupply = 100_000_000_000_000;
const uri = "";

main(name, symbol, uri, decimals, totalSupply);
