use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct PriceFeedAccount {
    #[max_len(64)]
    pub feed_id: String,
    pub price: i64,
    pub exponent: i32,
    pub conf: u64,
}
