use std::str::FromStr;

use anchor_lang::prelude::*;

use crate::{
    common::{
        constant::{ENSO_SEED, OPERATE_SYSTEM_PUBKEY},
        error::SettingAccountError,
    },
    states::PriceFeedAccount,
};

#[derive(Accounts)]
#[instruction(feed_id: String)]
pub struct SetPriceFeedAccount<'info> {
    #[account(
      mut,
      constraint = owner.key() == Pubkey::from_str(OPERATE_SYSTEM_PUBKEY).unwrap() @ SettingAccountError::InvalidOwner
    )]
    pub owner: Signer<'info>,
    #[account(
      init_if_needed,
      space = 8 + PriceFeedAccount::INIT_SPACE,
      payer = owner,
      seeds = [ENSO_SEED.as_ref(), feed_id.as_ref(), crate::ID.key().as_ref()],
      bump
    )]
    pub price_feed_account: Account<'info, PriceFeedAccount>,
    pub system_program: Program<'info, System>,
}

impl <'info> SetPriceFeedAccount<'info> {
    pub fn set_price(&mut self, feed_id: String, price: i64, exponent: i32, conf: u64) -> Result<()> {
      self.price_feed_account.set_inner(PriceFeedAccount {
        feed_id,
        conf,
        exponent,
        price
      });

      Ok(())
    }
}
