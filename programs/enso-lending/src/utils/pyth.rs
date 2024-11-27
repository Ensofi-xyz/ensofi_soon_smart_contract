use anchor_lang::prelude::*;
// use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::PriceFeedAccount;

// pub fn convert_to_usd_price(
//     price_feed_account: &PriceUpdateV2,
//     price_fee_id: &str,
//     amount: f64,
//     max_price_age_seconds: u64,
// ) -> Result<(f64, f64)> {
//     let feed_id: [u8; 32] = get_feed_id_from_hex(price_fee_id)?;
//     let current_price = price_feed_account.get_price_no_older_than(
//         &Clock::get()?,
//         max_price_age_seconds,
//         &feed_id,
//     )?;

//     let display_price = current_price.price as f64 / 10f64.powf(-current_price.exponent as f64);

//     msg!("Current price: {}", display_price);
//     msg!("Amount: {}", amount);

//     Ok((display_price * amount, display_price))
// }

// Note: used this until Pyth initialize price feed account
pub fn convert_to_usd_price_v1(
    price_feed_account: &PriceFeedAccount,
    _price_feed_id: &str,
    amount: f64,
    _max_price_age_seconds: u64,
) -> Result<(f64, f64)> {
    let display_price =
        price_feed_account.price as f64 / 10_f64.powf(-price_feed_account.exponent as f64);

    msg!("Current price: {}", display_price);
    msg!("Amount: {}", amount);

    Ok((display_price * amount, display_price))
}
