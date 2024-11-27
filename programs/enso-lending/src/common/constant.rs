use anchor_lang::prelude::{borsh, AnchorDeserialize, AnchorSerialize, InitSpace};

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq, InitSpace, Debug)]
pub enum LendOfferStatus {
    Created,
    Canceling,
    Canceled,
    Loaned,
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq, InitSpace, Debug)]
pub enum LoanOfferStatus {
    Matched,
    FundTransferred,
    Repay,
    BorrowerPaid,
    Liquidating,
    Liquidated,
    Finished
}

pub const ENSO_SEED: &[u8] = b"enso";
pub const SETTING_ACCOUNT_SEED: &[u8] = b"setting_account";
pub const ASSET_SEED: &[u8] = b"asset";
pub const VAULT_AUTHORITY_LOAN_OFFER_ACCOUNT_SEED: &[u8] = b"vault_authority_loan_offer";
pub const LEND_OFFER_ACCOUNT_SEED: &[u8] = b"lend_offer";
pub const LOAN_OFFER_ACCOUNT_SEED: &[u8] = b"loan_offer";

#[cfg(feature = "staging")]
pub const OPERATE_SYSTEM_PUBKEY: &str = "sysvYFEXhxW7FP32Ha15BBGWBEfMq1e1ScvFq61u5mG";
#[cfg(feature = "beta-test")]
pub const OPERATE_SYSTEM_PUBKEY: &str = "3tgRJnso4UAao8mPfraVJ1iYqvqeV6XAYB7Pn6sCNqMW";
#[cfg(feature = "dev")]
pub const OPERATE_SYSTEM_PUBKEY: &str = "opty8HWBKX3wW8c9qMPkmB4xnrCpMWWmQwqq7yGzmr4";
#[cfg(feature = "staging")]
pub const HOT_WALLET_PUBKEY: &str = "hotbEp8jbFUwfAGTUtLupGXE2JtrfZENLgRcSQsYk56";
#[cfg(feature = "beta-test")]
pub const HOT_WALLET_PUBKEY: &str = "FojhbwPUuSCRizQmWtzb6P3S1eQnZMsHLKFy7j6w9wr4";
#[cfg(feature = "dev")]
pub const HOT_WALLET_PUBKEY: &str = "Hot7zcvBTa3NybAnKrKtjcW1yJcoDWao39ZAoBn4mfPu";

#[cfg(all(not(feature = "staging"), not(feature = "beta-test"), not(feature = "dev")))]
pub const OPERATE_SYSTEM_PUBKEY: &str = "";
#[cfg(all(not(feature = "staging"), not(feature = "beta-test"), not(feature = "dev")))]
pub const HOT_WALLET_PUBKEY: &str = "";

#[cfg(feature = "devnet")]
pub const MIN_BORROW_HEALTH_RATIO: f64 = 1.1;
#[cfg(not(feature = "devnet"))]
pub const MIN_BORROW_HEALTH_RATIO: f64 = 1.2;

pub const DISCRIMINATOR: u8 = 0;

pub const MAX_ALLOWED_INTEREST: f64 = 200.0;