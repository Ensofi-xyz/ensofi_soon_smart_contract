use anchor_lang::prelude::*;
use anchor_spl::{
  token_2022::{
      transfer_checked, 
      Token2022, 
      TransferChecked,
  }, token_interface::{
      Mint as InterfaceMint, 
      TokenAccount as InterfaceTokenAccount
  }
};

use crate::{
  common::{
    constant::{
      ENSO_SEED, 
      LOAN_OFFER_ACCOUNT_SEED, 
      LoanOfferStatus, 
    },
    error::LoanOfferError,
    event::LoanOfferUpdateEvent
  },
  states::LoanOfferAccount, 
};

#[derive(Accounts)]
#[instruction(
  offer_id: String, 
  tier_id: String,
  borrow_amount: u64
)]
pub struct SystemUpdateLoanOffer<'info> {
  /// CHECK: This account is used to check the validate of wallet receive back lend amount
  #[account(
    constraint = borrower.key() == loan_offer.borrower @ LoanOfferError::InvalidBorrower
  )]
  pub borrower: AccountInfo<'info>,
  #[account(
    mut,
    associated_token::mint = mint_asset,
    associated_token::authority = borrower,
    associated_token::token_program = token_program
  )]
  pub borrower_ata_asset: InterfaceAccount<'info, InterfaceTokenAccount>,
  #[account(
    constraint = mint_asset.key() == loan_offer.lend_mint_token @ LoanOfferError::InvalidLendMintAsset,
  )]
  pub mint_asset: InterfaceAccount<'info, InterfaceMint>,
  #[account(
    mut,
    constraint = loan_offer.status == LoanOfferStatus::Matched @ LoanOfferError::InvalidLoanOffer,
    seeds = [
      ENSO_SEED.as_ref(),
      LOAN_OFFER_ACCOUNT_SEED.as_ref(),
      borrower.key().as_ref(),
      offer_id.as_bytes(),
      crate::ID.key().as_ref()
    ],
    bump = loan_offer.bump
  )]
  pub loan_offer: Account<'info, LoanOfferAccount>,
  #[account(mut)]
  pub system: Signer<'info>,
  #[account(
    mut,
    constraint = system_ata.amount >= borrow_amount @ LoanOfferError::NotEnoughAmount,
    associated_token::mint = mint_asset,
    associated_token::authority = system,
    associated_token::token_program = token_program
  )]
  pub system_ata: InterfaceAccount<'info, InterfaceTokenAccount>,
  pub token_program: Program<'info, Token2022>
}

impl<'info> SystemUpdateLoanOffer<'info> {
  pub fn system_update_loan_offer(&mut self, borrow_amount: u64) -> Result<()>  {
    if borrow_amount != self.loan_offer.borrow_amount {
      return err!(LoanOfferError::InvalidBorrowAmount)?;
    }

    self.transfer_lend_asset_to_borrower(borrow_amount)?;

    self.loan_offer.status = LoanOfferStatus::FundTransferred;

    self.emit_event_system_update_loan_offer()?;

    Ok(())
  }

  fn transfer_lend_asset_to_borrower(&mut self, borrow_amount: u64) -> Result<()> {
    let ctx = CpiContext::new(
      self.token_program.to_account_info(), 
      TransferChecked {
        from: self.system_ata.to_account_info(),
        mint: self.mint_asset.to_account_info(),
        to: self.borrower_ata_asset.to_account_info(),
        authority: self.system.to_account_info(),
    });

    transfer_checked(
      ctx,
      borrow_amount,
      self.mint_asset.decimals,
    )
  }

  fn emit_event_system_update_loan_offer(&mut self) -> Result<()> {
    emit!(LoanOfferUpdateEvent {
      tier_id: self.loan_offer.tier_id.clone(),
      lend_offer_id: self.loan_offer.lend_offer_id.clone(),
      interest: self.loan_offer.interest,
      borrow_amount: self.loan_offer.borrow_amount,
      lender_fee_percent: self.loan_offer.lender_fee_percent,
      duration: self.loan_offer.duration,
      lend_mint_token: self.loan_offer.lend_mint_token,
      lender: self.loan_offer.lender,
      offer_id: self.loan_offer.offer_id.clone(),
      borrower: self.loan_offer.borrower,
      collateral_mint_token: self.loan_offer.collateral_mint_token,
      collateral_amount: self.loan_offer.collateral_amount,
      status: self.loan_offer.status,
      borrower_fee_percent: self.loan_offer.borrower_fee_percent,
      started_at: self.loan_offer.started_at,
    });

    Ok(())
  }
}