use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::errors::UnsleptError;
use crate::events::{BufferDeposited, BufferWithdrawn};
use crate::state::*;

#[derive(Accounts)]
pub struct BufferAction<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"buffer_vault"], bump = config.vault_bump)]
    pub buffer_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"share_mint"], bump = config.share_mint_bump)]
    pub share_mint: Account<'info, Mint>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = depositor)]
    pub depositor_usdc: Account<'info, TokenAccount>,
    #[account(mut, token::mint = share_mint, token::authority = depositor)]
    pub depositor_shares: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Buffer value: liquid USDC plus USDC fronted to agents and not yet repaid.
fn total_assets(vault: &TokenAccount, config: &Config) -> Result<u64> {
    vault.amount.checked_add(config.outstanding_debt).ok_or(error!(UnsleptError::Overflow))
}

fn mul_div(a: u64, b: u64, c: u64) -> Result<u64> {
    require!(c > 0, UnsleptError::Overflow);
    u64::try_from((a as u128) * (b as u128) / (c as u128)).map_err(|_| error!(UnsleptError::Overflow))
}

pub fn deposit(ctx: Context<BufferAction>, assets: u64) -> Result<()> {
    let a = &ctx.accounts;
    require!(!a.config.paused, UnsleptError::ProtocolPaused);
    require!(assets > 0, UnsleptError::ZeroAmount);
    let total = total_assets(&a.buffer_vault, &a.config)?;
    require!(total.checked_add(assets).ok_or(error!(UnsleptError::Overflow))? <= a.config.params.deposit_cap, UnsleptError::CapExceeded);
    let supply = a.share_mint.supply;
    // First depositor gets 1:1 shares. Later deposits are priced at the current share value.
    let shares = if supply == 0 || total == 0 { assets } else { mul_div(assets, supply, total)? };
    require!(shares > 0, UnsleptError::ZeroAmount);

    token::transfer(
        CpiContext::new(a.token_program.to_account_info(), Transfer {
            from: a.depositor_usdc.to_account_info(),
            to: a.buffer_vault.to_account_info(),
            authority: a.depositor.to_account_info(),
        }),
        assets,
    )?;
    let seeds: &[&[u8]] = &[b"config", &[a.config.bump]];
    token::mint_to(
        CpiContext::new_with_signer(a.token_program.to_account_info(), MintTo {
            mint: a.share_mint.to_account_info(),
            to: a.depositor_shares.to_account_info(),
            authority: a.config.to_account_info(),
        }, &[seeds]),
        shares,
    )?;
    emit!(BufferDeposited { depositor: a.depositor.key(), assets, shares });
    Ok(())
}

/// Burns shares for their USDC value. Works while paused. Needs that much liquid USDC in the buffer.
pub fn withdraw(ctx: Context<BufferAction>, shares: u64) -> Result<()> {
    let a = &ctx.accounts;
    require!(shares > 0, UnsleptError::ZeroAmount);
    let total = total_assets(&a.buffer_vault, &a.config)?;
    let assets = mul_div(shares, total, a.share_mint.supply)?;
    require!(assets > 0, UnsleptError::ZeroAmount);
    require!(assets <= a.buffer_vault.amount, UnsleptError::InsufficientLiquidity);

    token::burn(
        CpiContext::new(a.token_program.to_account_info(), Burn {
            mint: a.share_mint.to_account_info(),
            from: a.depositor_shares.to_account_info(),
            authority: a.depositor.to_account_info(),
        }),
        shares,
    )?;
    let seeds: &[&[u8]] = &[b"config", &[a.config.bump]];
    token::transfer(
        CpiContext::new_with_signer(a.token_program.to_account_info(), Transfer {
            from: a.buffer_vault.to_account_info(),
            to: a.depositor_usdc.to_account_info(),
            authority: a.config.to_account_info(),
        }, &[seeds]),
        assets,
    )?;
    emit!(BufferWithdrawn { depositor: a.depositor.key(), assets, shares });
    Ok(())
}
