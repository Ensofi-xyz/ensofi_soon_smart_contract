use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  common::{
    constant::{
      ASSET_SEED,
      DISCRIMINATOR,
      ENSO_SEED,
      OPERATE_SYSTEM_PUBKEY
    },
    error::SettingAccountError,
    event::InitAssetEvent
  },
  states::{
    Asset,
    PriceFeedAccount
  }
};

#[derive(Accounts)]
pub struct InitAsset<'info> {
  #[account(
    mut,
    constraint = owner.key() == Pubkey::from_str(OPERATE_SYSTEM_PUBKEY).unwrap() @ SettingAccountError::InvalidOwner
  )]
  pub owner: Signer<'info>,
  pub token_mint: InterfaceAccount<'info, Mint>,
  #[account(
    init,
    payer = owner,
    space = (DISCRIMINATOR as usize) + Asset::INIT_SPACE,
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
  pub price_feed_account: Account<'info, PriceFeedAccount>,
  // pub price_feed_account: Account<'info, PriceUpdateV2>,
  pub system_program: Program<'info, System>,
}

impl<'info> InitAsset<'info>{
    pub fn init_asset(
      &mut self, 
      name: String, 
      is_lend: bool, 
      is_collateral: bool, 
      price_feed_id: String,
      max_price_age_seconds: u64,
      bumps: &InitAssetBumps
    ) -> Result<()> {
      self.asset.set_inner(Asset {
        name,
        token_mint: self.token_mint.key(),
        decimals: self.token_mint.decimals,
        is_collateral,
        is_lend,
        max_price_age_seconds,
        price_feed_account: self.price_feed_account.key(),
        price_feed_id,
        bump: bumps.asset
      });

      self.emit_init_asset_event()?;

      Ok(())
    }

    fn emit_init_asset_event(&mut self) -> Result<()> {
      emit!(InitAssetEvent {
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