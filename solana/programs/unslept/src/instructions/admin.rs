use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::UnsleptError;
use crate::events::{ParamsApplied, ParamsProposed};
use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(
        init, payer = admin, seeds = [b"buffer_vault"], bump,
        token::mint = usdc_mint, token::authority = config,
    )]
    pub buffer_vault: Account<'info, TokenAccount>,
    #[account(
        init, payer = admin, seeds = [b"share_mint"], bump,
        mint::decimals = usdc_mint.decimals, mint::authority = config,
    )]
    pub share_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize(ctx: Context<Initialize>, params: Params) -> Result<()> {
    require!(params.fee_bps <= MAX_FEE_BPS, UnsleptError::FeeTooHigh);
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.admin.key();
    c.pending_admin = Pubkey::default();
    c.usdc_mint = ctx.accounts.usdc_mint.key();
    c.params = params;
    c.pending_params = Params::default();
    c.pending_eta = 0;
    c.outstanding_debt = 0;
    c.paused = false;
    c.bump = ctx.bumps.config;
    c.vault_bump = ctx.bumps.buffer_vault;
    c.share_mint_bump = ctx.bumps.share_mint;
    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ UnsleptError::NotAdmin)]
    pub config: Account<'info, Config>,
}

/// Parameter changes wait 24 hours, so depositors and agents can react before they apply.
pub fn propose_params(ctx: Context<AdminOnly>, params: Params) -> Result<()> {
    require!(params.fee_bps <= MAX_FEE_BPS, UnsleptError::FeeTooHigh);
    let c = &mut ctx.accounts.config;
    let eta = Clock::get()?.unix_timestamp + CONFIG_DELAY;
    c.pending_params = params;
    c.pending_eta = eta;
    emit!(ParamsProposed { params, eta });
    Ok(())
}

pub fn cancel_params(ctx: Context<AdminOnly>) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.pending_params = Params::default();
    c.pending_eta = 0;
    Ok(())
}

pub fn propose_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_admin = new_admin;
    Ok(())
}

#[derive(Accounts)]
pub struct ApplyParams<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
}

/// Anyone can apply a pending change once its delay has passed.
pub fn apply_params(ctx: Context<ApplyParams>) -> Result<()> {
    let c = &mut ctx.accounts.config;
    let now = Clock::get()?.unix_timestamp;
    require!(c.pending_eta != 0 && now >= c.pending_eta, UnsleptError::NotReady);
    c.params = c.pending_params;
    c.pending_params = Params::default();
    c.pending_eta = 0;
    emit!(ParamsApplied { params: c.params });
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub new_admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, constraint = config.pending_admin == new_admin.key() @ UnsleptError::NotAdmin)]
    pub config: Account<'info, Config>,
}

pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.new_admin.key();
    c.pending_admin = Pubkey::default();
    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut, seeds = [b"config"], bump = config.bump,
        constraint = authority.key() == config.admin || authority.key() == config.params.pauser @ UnsleptError::NotPauser,
    )]
    pub config: Account<'info, Config>,
}

/// Pausing blocks new deposits and payments. Withdrawals and debt repayment always stay open.
pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}
