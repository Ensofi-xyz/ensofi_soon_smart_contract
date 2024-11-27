use anchor_lang::prelude::Pubkey;
use solana_program::pubkey;

cfg_if::cfg_if!{
  if #[cfg(all(feature = "devnet", feature = "beta-test"))] {
    pub const PROGRAM_ID: Pubkey = pubkey!("2hkbmUPd72tUnwg64k89yVkSWRLvQRpYEkhq9Yv8WeJb");
  } else if #[cfg(all(feature = "devnet", feature = "dev"))] {
    pub const PROGRAM_ID: Pubkey = pubkey!("DKUHHKPYbLtPf4pSoURxfJKUXhdwtpoeHAdpknMta5VF");
  } else if #[cfg(all(feature = "staging"))] {
    pub const PROGRAM_ID: Pubkey = pubkey!("ensoQXKf4MvNuEC3M9xmcqUqgucFNd5UzAonDdUtgqn");
  } else {
    // Default use for localnet
    pub const PROGRAM_ID: Pubkey = pubkey!("G3LQL3DpD8Bd5q3ERGZwqAgkgyFKJTbt9ViCpu1hVd6o");
  }
}