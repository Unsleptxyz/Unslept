//! Agent yield positions on Kamino Lend.
//!
//! The agent PDA deposits USDC from its vault into the configured Kamino reserve and holds the cTokens in a token
//! account it owns. `position_value` tracks the USDC cost basis of those cTokens. It is a conservative collateral
//! value: interest earned shows up as extra USDC when the position is redeemed, never as extra borrowing room.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::UnsleptError;
use crate::events::{YieldDeposited, YieldRedeemed};
use crate::state::*;

const IX_DEPOSIT_RESERVE_LIQUIDITY: [u8; 8] = [169, 201, 30, 126, 6, 205, 102, 68];
const IX_REDEEM_RESERVE_COLLATERAL: [u8; 8] = [234, 117, 181, 125, 185, 142, 220, 29];

fn klend_data(disc: [u8; 8], amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&disc);
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

#[derive(Accounts)]
pub struct YieldDeposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, has_one = owner @ UnsleptError::NotOwner)]
    pub agent: Box<Account<'info, Agent>>,
    #[account(mut, seeds = [b"agent_vault", agent.key().as_ref()], bump = agent.vault_bump)]
    pub agent_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = owner, seeds = [b"agent_ctoken", agent.key().as_ref()], bump,
        token::mint = ctoken_mint, token::authority = agent,
    )]
    pub agent_ctoken: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.yield_ctoken_mint)]
    pub ctoken_mint: Box<Account<'info, Mint>>,
    #[account(address = config.usdc_mint @ UnsleptError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// CHECK: must be the configured reserve; Kamino validates the rest.
    #[account(mut, address = config.yield_reserve)]
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino (reserve has_one lending_market).
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino (PDA of the market).
    pub lending_market_authority: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino (reserve liquidity supply vault).
    #[account(mut)]
    pub reserve_liquidity_supply: UncheckedAccount<'info>,
    /// CHECK: fixed address.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    /// CHECK: fixed address.
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Owner moves liquid USDC from the agent vault into Kamino.
pub fn yield_deposit(mut ctx: Context<YieldDeposit>, amount: u64) -> Result<()> {
    let a = &mut ctx.accounts;
    require!(!a.config.paused, UnsleptError::ProtocolPaused);
    require!(a.config.yield_reserve != Pubkey::default(), UnsleptError::YieldReserveNotSet);
    require!(amount > 0, UnsleptError::ZeroAmount);

    let vault_before = a.agent_vault.amount;
    let ct_before = a.agent_ctoken.amount;

    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(a.agent.key(), true),
            AccountMeta::new(a.reserve.key(), false),
            AccountMeta::new_readonly(a.lending_market.key(), false),
            AccountMeta::new_readonly(a.lending_market_authority.key(), false),
            AccountMeta::new_readonly(a.usdc_mint.key(), false),
            AccountMeta::new(a.reserve_liquidity_supply.key(), false),
            AccountMeta::new(a.ctoken_mint.key(), false),
            AccountMeta::new(a.agent_vault.key(), false),
            AccountMeta::new(a.agent_ctoken.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(a.instruction_sysvar.key(), false),
        ],
        data: klend_data(IX_DEPOSIT_RESERVE_LIQUIDITY, amount),
    };
    let id = a.agent.agent_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"agent", a.agent.owner.as_ref(), &id, &[a.agent.bump]];
    invoke_signed(
        &ix,
        &[
            a.agent.to_account_info(),
            a.reserve.to_account_info(),
            a.lending_market.to_account_info(),
            a.lending_market_authority.to_account_info(),
            a.usdc_mint.to_account_info(),
            a.reserve_liquidity_supply.to_account_info(),
            a.ctoken_mint.to_account_info(),
            a.agent_vault.to_account_info(),
            a.agent_ctoken.to_account_info(),
            a.token_program.to_account_info(),
            a.instruction_sysvar.to_account_info(),
            a.klend_program.to_account_info(),
        ],
        &[seeds],
    )?;

    a.agent_vault.reload()?;
    a.agent_ctoken.reload()?;
    let spent = vault_before.checked_sub(a.agent_vault.amount).ok_or(error!(UnsleptError::Overflow))?;
    let minted = a.agent_ctoken.amount.saturating_sub(ct_before);
    a.agent.position_value = a.agent.position_value.checked_add(spent).ok_or(error!(UnsleptError::Overflow))?;

    emit!(YieldDeposited { agent: a.agent.key(), amount: spent, ctokens: minted });
    Ok(())
}

#[derive(Accounts)]
pub struct YieldRedeem<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub agent: Box<Account<'info, Agent>>,
    #[account(mut, seeds = [b"agent_vault", agent.key().as_ref()], bump = agent.vault_bump)]
    pub agent_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"agent_ctoken", agent.key().as_ref()], bump)]
    pub agent_ctoken: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"buffer_vault"], bump = config.vault_bump)]
    pub buffer_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.yield_ctoken_mint)]
    pub ctoken_mint: Box<Account<'info, Mint>>,
    #[account(address = config.usdc_mint @ UnsleptError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// CHECK: must be the configured reserve; Kamino validates the rest.
    #[account(mut, address = config.yield_reserve)]
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino.
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino.
    pub lending_market_authority: UncheckedAccount<'info>,
    /// CHECK: validated by Kamino.
    #[account(mut)]
    pub reserve_liquidity_supply: UncheckedAccount<'info>,
    /// CHECK: fixed address.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    /// CHECK: fixed address.
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Owner or keeper redeems cTokens back into the agent vault. Redeemed USDC repays buffer debt first; the rest stays
/// liquid in the vault. Works while the protocol is paused, so owners can always exit.
pub fn yield_redeem(mut ctx: Context<YieldRedeem>, ctokens: u64) -> Result<()> {
    let a = &mut ctx.accounts;
    let caller = a.caller.key();
    require!(
        caller == a.agent.owner || caller == a.config.params.keeper,
        UnsleptError::NotOwnerOrKeeper
    );
    require!(ctokens > 0, UnsleptError::ZeroAmount);
    let ct_before = a.agent_ctoken.amount;
    require!(ctokens <= ct_before, UnsleptError::InsufficientPosition);
    let vault_before = a.agent_vault.amount;

    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(a.agent.key(), true),
            AccountMeta::new_readonly(a.lending_market.key(), false),
            AccountMeta::new(a.reserve.key(), false),
            AccountMeta::new_readonly(a.lending_market_authority.key(), false),
            AccountMeta::new_readonly(a.usdc_mint.key(), false),
            AccountMeta::new(a.ctoken_mint.key(), false),
            AccountMeta::new(a.reserve_liquidity_supply.key(), false),
            AccountMeta::new(a.agent_ctoken.key(), false),
            AccountMeta::new(a.agent_vault.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(a.instruction_sysvar.key(), false),
        ],
        data: klend_data(IX_REDEEM_RESERVE_COLLATERAL, ctokens),
    };
    let id = a.agent.agent_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"agent", a.agent.owner.as_ref(), &id, &[a.agent.bump]];
    invoke_signed(
        &ix,
        &[
            a.agent.to_account_info(),
            a.lending_market.to_account_info(),
            a.reserve.to_account_info(),
            a.lending_market_authority.to_account_info(),
            a.usdc_mint.to_account_info(),
            a.ctoken_mint.to_account_info(),
            a.reserve_liquidity_supply.to_account_info(),
            a.agent_ctoken.to_account_info(),
            a.agent_vault.to_account_info(),
            a.token_program.to_account_info(),
            a.instruction_sysvar.to_account_info(),
            a.klend_program.to_account_info(),
        ],
        &[seeds],
    )?;

    a.agent_vault.reload()?;
    a.agent_ctoken.reload()?;
    let received = a.agent_vault.amount.checked_sub(vault_before).ok_or(error!(UnsleptError::Overflow))?;
    let burned = ct_before.saturating_sub(a.agent_ctoken.amount);
    // Release cost basis in proportion to the cTokens burned.
    let released = ((a.agent.position_value as u128) * (burned as u128) / (ct_before as u128)) as u64;
    a.agent.position_value = a.agent.position_value.saturating_sub(released);

    let liquid = a.agent_vault.amount;
    let repaid = crate::instructions::pay::repay_from_vault(
        &mut a.agent,
        &mut a.config,
        &a.agent_vault,
        &a.buffer_vault,
        &a.token_program,
        liquid,
    )?;
    emit!(YieldRedeemed { agent: a.agent.key(), ctokens: burned, received, repaid });
    Ok(())
}
