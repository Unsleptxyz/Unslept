use anchor_lang::prelude::*;

pub const MAX_FEE_BPS: u16 = 100; // 1%
pub const BPS: u64 = 10_000;
pub const CONFIG_DELAY: i64 = 24 * 60 * 60; // 24-hour delay on parameter changes
pub const MAX_ALLOWLIST: usize = 8;
pub const PAYMENT_RECORD_TTL: i64 = 24 * 60 * 60;
/// Share of an agent's yield position that may back buffer debt.
pub const COLLATERAL_BPS: u64 = 9_500;
/// Kamino Lend program (same id on mainnet and devnet).
pub const KLEND_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
pub const INSTRUCTIONS_SYSVAR_ID: Pubkey = pubkey!("Sysvar1nstructions1111111111111111111111111");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, PartialEq, Eq, Debug)]
pub struct Params {
    pub fee_bps: u16,
    pub deposit_cap: u64,
    pub pauser: Pubkey,
    pub keeper: Pubkey,
    pub treasury: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub params: Params,
    pub pending_params: Params,
    /// Unix time after which pending_params can be applied. 0 when nothing is pending.
    pub pending_eta: i64,
    /// USDC the buffer has fronted and not yet been repaid.
    pub outstanding_debt: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
    pub share_mint_bump: u8,
    /// Kamino reserve that holds agent yield positions. Set once by the admin.
    pub yield_reserve: Pubkey,
    /// Collateral (cToken) mint of that reserve.
    pub yield_ctoken_mint: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub owner: Pubkey,
    pub signer: Pubkey,
    pub agent_id: u64,
    pub per_call_cap: u64,
    pub daily_cap: u64,
    pub spent_today: u64,
    pub spend_day: i64,
    pub paused: bool,
    pub revoked: bool,
    /// USDC owed to the buffer.
    pub debt: u64,
    /// Value of the agent's yield position, in USDC, as last refreshed by the yield adapter. Backs debt.
    pub position_value: u64,
    pub payments: u64,
    pub allowlist_len: u8,
    pub allowlist: [Pubkey; MAX_ALLOWLIST],
    pub bump: u8,
    pub vault_bump: u8,
}

impl Agent {
    pub fn payee_allowed(&self, payee_owner: &Pubkey) -> bool {
        let n = self.allowlist_len as usize;
        n == 0 || self.allowlist[..n].iter().any(|p| p == payee_owner)
    }
    pub fn max_debt(&self) -> u64 {
        ((self.position_value as u128) * (COLLATERAL_BPS as u128) / (BPS as u128)) as u64
    }
}

/// One per settled payment. Proves to the merchant that payment_id was paid, and blocks reuse.
#[account]
#[derive(InitSpace)]
pub struct Payment {
    pub payment_id: [u8; 32],
    pub agent: Pubkey,
    /// Owner of the token account that received the USDC.
    pub payee: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub endpoint_hash: [u8; 32],
    pub slot: u64,
    pub ts: i64,
    /// Who paid the rent; gets it back when the record is closed.
    pub rent_payer: Pubkey,
    pub bump: u8,
}
