use anchor_lang::prelude::*;
use anchor_spl::{
  token_2022::{
      transfer_checked, 
      Token2022, 
      TransferChecked,
  }, 
  token_interface::{
      Mint as InterfaceMint, 
      TokenAccount as InterfaceTokenAccount
  }
};

use crate::{
  common::{
      constant::{
          ENSO_SEED,
          LEND_OFFER_ACCOUNT_SEED,
          LendOfferStatus,
      }, 
      error::LendOfferError,
      event::LendOfferCanceledEvent
  },
  states::LendOfferAccount
};

#[derive(Accounts)]
#[instruction(
  offer_id: String, 
  tier_id: String
)]
pub struct SystemCancelLendOffer<'info> {
  #[account(
    constraint = lender.key() == lend_offer.lender @ LendOfferError::InvalidLender
  )]
  pub lender: SystemAccount<'info>,
  #[account(
    mut,
    associated_token::mint = mint_asset,
    associated_token::authority = lender,
    associated_token::token_program = token_program
  )]
  pub lender_ata_asset: InterfaceAccount<'info, InterfaceTokenAccount>,
  #[account(
    constraint = mint_asset.key() == lend_offer.lend_mint_token @ LendOfferError::InvalidMintAsset,
  )]
  pub mint_asset: InterfaceAccount<'info, InterfaceMint>,
  #[account(
    mut,
    constraint = lend_offer.status == LendOfferStatus::Canceling @ LendOfferError::InvalidOfferStatus,
    seeds = [
      ENSO_SEED.as_ref(),
      LEND_OFFER_ACCOUNT_SEED.as_ref(),  
      lender.key().as_ref(), 
      offer_id.as_bytes(),
      crate::ID.key().as_ref(), 
    ],
    bump = lend_offer.bump
  )]
  pub lend_offer: Account<'info, LendOfferAccount>,
  #[account(mut)]
  pub system: Signer<'info>,
  #[account(
    mut,
    associated_token::mint = mint_asset,
    associated_token::authority = system,
    associated_token::token_program = token_program
  )]
  pub system_ata: InterfaceAccount<'info, InterfaceTokenAccount>,
  pub token_program: Program<'info, Token2022>
}

impl<'info> SystemCancelLendOffer<'info> {
  pub fn system_cancel_lend_offer(&mut self, waiting_interest: u64) -> Result<()>  {
    let total_repay = self.get_total_repay(self.lend_offer.amount, waiting_interest);

    if total_repay > self.system_ata.amount {
      return err!(LendOfferError::NotEnoughAmount);
    }

    self.transfer_back_lend_asset(total_repay)?;

    self.lend_offer.status = LendOfferStatus::Canceled;

    self.emit_event_cancel_lend_offer(total_repay)?;

    Ok(())
  }

  fn transfer_back_lend_asset(&mut self, total_repay: u64) -> Result<()> {
    let ctx = CpiContext::new(
      self.token_program.to_account_info(), 
      TransferChecked {
        from: self.system_ata.to_account_info(),
        mint: self.mint_asset.to_account_info(),
        to: self.lender_ata_asset.to_account_info(),
        authority: self.system.to_account_info(),
      }
    );

    transfer_checked(
        ctx,
        total_repay,
        self.mint_asset.decimals,
    )
  }

  fn emit_event_cancel_lend_offer(&mut self, total_repay: u64) -> Result<()> {
    emit!(LendOfferCanceledEvent {
      lender: self.lender.key(),
      amount: total_repay,
      duration: self.lend_offer.duration,
      interest: self.lend_offer.interest,
      lender_fee_percent: self.lend_offer.lender_fee_percent,
      offer_id: self.lend_offer.offer_id.clone()
    });

    Ok(())
  }

  fn get_total_repay(&self, lend_amount: u64, waiting_interest: u64) -> u64 {
    return lend_amount + waiting_interest;
  }
}