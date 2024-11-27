use std::str::FromStr;

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
          OPERATE_SYSTEM_PUBKEY,
      },
      error::LiquidateOfferError,
      event::LiquidatedCollateralEvent
  },
  states::LoanOfferAccount,
  utils::duration_to_year,
};

#[derive(Accounts)]
#[instruction(loan_offer_id: String)]
pub struct SystemLiquidateLoanOffer<'info> {
  #[account(
    mut,
    constraint = system.key() == Pubkey::from_str(OPERATE_SYSTEM_PUBKEY).unwrap() @ LiquidateOfferError::InvalidSystem
  )]
  pub system: Signer<'info>,
  #[account(
    mut,
    associated_token::mint = mint_asset,
    associated_token::authority = system,
    associated_token::token_program = token_program
  )]
  pub system_ata: InterfaceAccount<'info, InterfaceTokenAccount>,
  #[account(
    constraint = mint_asset.key() == loan_offer.lend_mint_token @ LiquidateOfferError::InvalidMintAsset,
  )]
  pub mint_asset: InterfaceAccount<'info, InterfaceMint>,
  /// CHECK: This account is used to transfer back collateral for borrower
  #[account(
    constraint = borrower.key() == loan_offer.borrower @ LiquidateOfferError::InvalidBorrower
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
    mut,
    constraint = loan_offer.status == LoanOfferStatus::Liquidating @ LiquidateOfferError::InvalidOfferStatus,
    seeds = [
      ENSO_SEED.as_ref(),
      LOAN_OFFER_ACCOUNT_SEED.as_ref(),
      borrower.key().as_ref(),
      loan_offer_id.as_bytes(),
      crate::ID.key().as_ref()
    ],
    bump = loan_offer.bump
  )]
  pub loan_offer: Account<'info, LoanOfferAccount>,
  pub token_program: Program<'info, Token2022>,
}

impl<'info> SystemLiquidateLoanOffer<'info> {
  pub fn system_liquidate_loan_offer(
    &mut self,
    collateral_swapped_amount: u64,
    liquidated_price: u64,
    liquidated_tx: String,
  ) -> Result<()> {
    let remaining_fund_to_borrower = self.get_remaining_fund(collateral_swapped_amount);

    if remaining_fund_to_borrower > 0 {
      self.transfer_asset_to_borrower(remaining_fund_to_borrower)?;
    }

    let loan_offer = &mut self.loan_offer;
    loan_offer.liquidated_price = Some(liquidated_price);
    loan_offer.liquidated_tx = Some(liquidated_tx);
    loan_offer.status = LoanOfferStatus::Liquidated;
    
    self.emit_event_system_liquidate_loan_offer(
      remaining_fund_to_borrower,
      collateral_swapped_amount,
    )?;
    Ok(())
  }

  fn transfer_asset_to_borrower(&mut self, remaining_fund_to_borrower: u64) -> Result<()> {
    self.process_transfer(
      remaining_fund_to_borrower,
      self.borrower_ata_asset.to_account_info(),
    )?;
    Ok(())
  }

  fn process_transfer(&mut self, amount: u64, to: AccountInfo<'info>) -> Result<()> {
    let ctx = CpiContext::new(
      self.token_program.to_account_info(), 
      TransferChecked {
        from: self.system_ata.to_account_info(),
        mint: self.mint_asset.to_account_info(),
        to,
        authority: self.system.to_account_info(),
    });

    transfer_checked(
      ctx,
      amount,
      self.mint_asset.decimals,
    )
  }

  fn emit_event_system_liquidate_loan_offer(
    &mut self,
    remaining_fund_to_borrower: u64,
    collateral_swapped_amount: u64,
  ) -> Result<()> {
    emit!(LiquidatedCollateralEvent {
      system: self.system.key(),
      lender: self.loan_offer.lender.key(),
      borrower: self.borrower.key(),
      loan_offer_id: self.loan_offer.offer_id.clone(),
      collateral_swapped_amount,
      status: self.loan_offer.status,
      liquidated_price: self.loan_offer.liquidated_price.unwrap(),
      liquidated_tx: self.loan_offer.liquidated_tx.as_ref().unwrap().clone(),
      remaining_fund_to_borrower
    });
    Ok(())
  }

  fn get_remaining_fund(&self, collateral_swapped_amount: u64) -> u64 {
    let loan_interest_percent = self.loan_offer.interest / 100.0;
    let borrower_fee_percent = self.loan_offer.borrower_fee_percent / 100.0;
    let time_borrowed = duration_to_year(self.loan_offer.duration);
    let interest_loan_amount =
        loan_interest_percent * self.loan_offer.borrow_amount as f64 * time_borrowed;

    let borrower_fee_amount =
        borrower_fee_percent * interest_loan_amount;

    return (collateral_swapped_amount as f64
      - self.loan_offer.borrow_amount as f64
      - interest_loan_amount
      - borrower_fee_amount) as u64;
  }
}
