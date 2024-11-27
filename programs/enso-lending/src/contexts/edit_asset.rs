use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  common::{
    constant::{ASSET_SEED, ENSO_SEED, OPERATE_SYSTEM_PUBKEY},
    error::SettingAccountError,
    event::EditAssetEvent
  },
  states::{
    Asset,
    PriceFeedAccount
  }
};

#[derive(Accounts)]
pub struct EditAsset<'info> {
  #[account(
    mut,
    constraint = owner.key() == Pubkey::from_str(OPERATE_SYSTEM_PUBKEY).unwrap() @ SettingAccountError::InvalidOwner
  )]
  pub owner: Signer<'info>,
  pub token_mint: InterfaceAccount<'info, Mint>,
  #[account(
    mut,
    seeds = [
      ENSO_SEED.as_ref(),
      ASSET_SEED.as_ref(),
      token_mint.key().as_ref(),
      crate::ID.key().as_ref()
    ],
    bump
  )]
  pub asset: Account<'info, Asset>,
  /// CHECK: Will revert after account is initialized
  pub price_feed_account: Option<Account<'info, PriceFeedAccount>>,
  // pub price_feed_account: Option<Account<'info, PriceUpdateV2>>
}

impl<'info> EditAsset<'info> {
  pub fn edit_asset(
    &mut self, 
    name: Option<String>, 
    is_lend: Option<bool>, 
    is_collateral: Option<bool>, 
    price_feed_id: Option<String>,
    max_price_age_seconds: Option<u64>,
  ) -> Result<()> {
    let asset = &mut self.asset;

    if let Some(name) = name {
      asset.name = name;
    }
    if let Some(is_lend) = is_lend {
      asset.is_lend = is_lend;
    }
    if let Some(is_collateral) = is_collateral {
      asset.is_collateral = is_collateral;
    }
    if let Some(price_feed_id) = price_feed_id {
      asset.price_feed_id = price_feed_id;
    }
    if let Some(max_price_age_seconds) = max_price_age_seconds {
      asset.max_price_age_seconds = max_price_age_seconds;
    }
    if let Some(price_feed_account) = &self.price_feed_account {
      asset.price_feed_account = price_feed_account.key();
    }

    self.emit_edit_asset_event()?;

    Ok(())
  }

  fn emit_edit_asset_event(&mut self) -> Result<()> {
    emit!(EditAssetEvent {
      name: self.asset.name.clone(),
      token_mint: self.asset.token_mint.key(),
      decimals: self.asset.decimals,
      is_collateral: self.asset.is_collateral,
      is_lend: self.asset.is_lend,
      max_price_age_seconds: self.asset.max_price_age_seconds,
      price_feed_account: self.asset.price_feed_account.key(),
      price_feed_id: self.asset.price_feed_id.clone(),
      bump: self.asset.bump
    });
          
    Ok(())
  }
}