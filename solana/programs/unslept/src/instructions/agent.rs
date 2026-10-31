use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::UnsleptError;
use crate::events::{AgentCreated, DebtRepaid};
use crate::state::*;

#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct CreateAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.usdc_mint @ UnsleptError::WrongMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init, payer = owner, space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", owner.key().as_ref(), &agent_id.to_le_bytes()], bump,
    )]
    pub agent: Account<'info, Agent>,
    #[account(
        init, payer = owner, seeds = [b"agent_vault", agent.key().as_ref()], bump,
        token::mint = usdc_mint, token::authority = agent,
    )]
    pub agent_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_agent(ctx: Context<CreateAgent>, agent_id: u64, signer: Pubkey, per_call_cap: u64, daily_cap: u64) -> Result<()> {
    let a = &mut ctx.accounts.agent;
    a.owner = ctx.accounts.owner.key();
    a.signer = signer;
    a.agent_id = agent_id;
    a.per_call_cap = per_call_cap;
    a.daily_cap = daily_cap;
    a.spent_today = 0;
    a.spend_day = 0;
    a.paused = false;
    a.revoked = false;
    a.debt = 0;
    a.position_value = 0;
    a.payments = 0;
    a.allowlist_len = 0;
    a.allowlist = [Pubkey::default(); MAX_ALLOWLIST];
    a.bump = ctx.bumps.agent;
    a.vault_bump = ctx.bumps.agent_vault;
    emit!(AgentCreated { agent: a.key(), owner: a.owner, signer, agent_id });
    Ok(())
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ UnsleptError::NotOwner)]
    pub agent: Account<'info, Agent>,
}

pub fn set_policy(ctx: Context<OwnerOnly>, per_call_cap: u64, daily_cap: u64) -> Result<()> {
    let a = &mut ctx.accounts.agent;
    a.per_call_cap = per_call_cap;
    a.daily_cap = daily_cap;
    Ok(())
}

pub fn set_signer(ctx: Context<OwnerOnly>, signer: Pubkey) -> Result<()> {
    ctx.accounts.agent.signer = signer;
    Ok(())
}

pub fn set_agent_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
    ctx.accounts.agent.paused = paused;
    Ok(())
}

/// Permanent. The signer can never pay again; the owner keeps withdrawal rights.
pub fn revoke(ctx: Context<OwnerOnly>) -> Result<()> {
    let a = &mut ctx.accounts.agent;
    a.revoked = true;
    a.signer = Pubkey::default();
    Ok(())
}

/// Payees are token account owners (merchant wallets). An empty list allows every payee.
pub fn set_allowlist(ctx: Context<OwnerOnly>, payees: Vec<Pubkey>) -> Result<()> {
    require!(payees.len() <= MAX_ALLOWLIST, UnsleptError::AllowlistTooLong);
    let a = &mut ctx.accounts.agent;
    a.allowlist = [Pubkey::default(); MAX_ALLOWLIST];
    for (i, p) in payees.iter().enumerate() {
        a.allowlist[i] = *p;
    }
    a.allowlist_len = payees.len() as u8;
    Ok(())
}

#[derive(Accounts)]
pub struct AgentWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ UnsleptError::NotOwner)]
    pub agent: Account<'info, Agent>,
    #[account(mut, seeds = [b"agent_vault", agent.key().as_ref()], bump = agent.vault_bump)]
    pub agent_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = agent_vault.mint)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Owner withdraws liquid USDC. Allowed while the protocol is paused. Debt must stay covered by the yield position.
pub fn agent_withdraw(ctx: Context<AgentWithdraw>, amount: u64) -> Result<()> {
    let a = &ctx.accounts;
    require!(amount > 0, UnsleptError::ZeroAmount);
    require!(a.agent.debt <= a.agent.max_debt(), UnsleptError::WouldLeaveDebtUncovered);
    let id = a.agent.agent_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"agent", a.agent.owner.as_ref(), &id, &[a.agent.bump]];
    token::transfer(
        CpiContext::new_with_signer(a.token_program.key(), Transfer {
            from: a.agent_vault.to_account_info(),
            to: a.destination.to_account_info(),
            authority: a.agent.to_account_info(),
        }, &[seeds]),
        amount,
    )
}

#[derive(Accounts)]
pub struct RepayDebt<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub agent: Account<'info, Agent>,
    #[account(mut, seeds = [b"agent_vault", agent.key().as_ref()], bump = agent.vault_bump)]
    pub agent_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"buffer_vault"], bump = config.vault_bump)]
    pub buffer_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Permissionless: moves the agent's liquid USDC back to the buffer until its debt is zero.
pub fn repay_debt(mut ctx: Context<RepayDebt>) -> Result<()> {
    let paid = crate::instructions::pay::repay_from_vault(
        &mut ctx.accounts.agent,
        &mut ctx.accounts.config,
        &ctx.accounts.agent_vault,
        &ctx.accounts.buffer_vault,
        &ctx.accounts.token_program,
        ctx.accounts.agent_vault.amount,
    )?;
    emit!(DebtRepaid { agent: ctx.accounts.agent.key(), amount: paid, remaining: ctx.accounts.agent.debt });
    Ok(())
}
