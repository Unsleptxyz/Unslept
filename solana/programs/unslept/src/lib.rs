//! Unslept on Solana: agent payment accounts with on-chain spending policy, a shared USDC buffer that settles
//! x402 payments instantly, and debt backed by the agent's yield position.
use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::Params;

declare_id!("7pq53ZQ8JRCaPoorjfnuCmMFDQEeEgDMnE1D92gA3t2W");

#[program]
pub mod unslept {
    use super::*;

    // Admin
    pub fn initialize(ctx: Context<Initialize>, params: Params) -> Result<()> {
        instructions::admin::initialize(ctx, params)
    }
    pub fn propose_params(ctx: Context<AdminOnly>, params: Params) -> Result<()> {
        instructions::admin::propose_params(ctx, params)
    }
    pub fn cancel_params(ctx: Context<AdminOnly>) -> Result<()> {
        instructions::admin::cancel_params(ctx)
    }
    pub fn apply_params(ctx: Context<ApplyParams>) -> Result<()> {
        instructions::admin::apply_params(ctx)
    }
    pub fn propose_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
        instructions::admin::propose_admin(ctx, new_admin)
    }
    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::admin::accept_admin(ctx)
    }
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::admin::set_paused(ctx, paused)
    }

    // Buffer
    pub fn buffer_deposit(ctx: Context<BufferAction>, assets: u64) -> Result<()> {
        instructions::buffer::deposit(ctx, assets)
    }
    pub fn buffer_withdraw(ctx: Context<BufferAction>, shares: u64) -> Result<()> {
        instructions::buffer::withdraw(ctx, shares)
    }

    // Agents
    pub fn create_agent(ctx: Context<CreateAgent>, agent_id: u64, signer: Pubkey, per_call_cap: u64, daily_cap: u64) -> Result<()> {
        instructions::agent::create_agent(ctx, agent_id, signer, per_call_cap, daily_cap)
    }
    pub fn set_policy(ctx: Context<OwnerOnly>, per_call_cap: u64, daily_cap: u64) -> Result<()> {
        instructions::agent::set_policy(ctx, per_call_cap, daily_cap)
    }
    pub fn set_signer(ctx: Context<OwnerOnly>, signer: Pubkey) -> Result<()> {
        instructions::agent::set_signer(ctx, signer)
    }
    pub fn set_agent_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
        instructions::agent::set_agent_paused(ctx, paused)
    }
    pub fn revoke(ctx: Context<OwnerOnly>) -> Result<()> {
        instructions::agent::revoke(ctx)
    }
    pub fn set_allowlist(ctx: Context<OwnerOnly>, payees: Vec<Pubkey>) -> Result<()> {
        instructions::agent::set_allowlist(ctx, payees)
    }
    pub fn agent_withdraw(ctx: Context<AgentWithdraw>, amount: u64) -> Result<()> {
        instructions::agent::agent_withdraw(ctx, amount)
    }
    pub fn repay_debt(ctx: Context<RepayDebt>) -> Result<()> {
        instructions::agent::repay_debt(ctx)
    }

    // Payments
    pub fn pay(ctx: Context<Pay>, payment_id: [u8; 32], amount: u64, endpoint_hash: [u8; 32]) -> Result<()> {
        instructions::pay::pay(ctx, payment_id, amount, endpoint_hash)
    }
    pub fn close_payment(ctx: Context<ClosePayment>) -> Result<()> {
        instructions::pay::close_payment(ctx)
    }
}
