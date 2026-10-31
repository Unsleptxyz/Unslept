use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::UnsleptError;
use crate::events::Settled;
use crate::state::*;

/// Moves up to `available` USDC from the agent vault to the buffer against the agent's debt. Returns the amount moved.
pub fn repay_from_vault<'info>(
    agent: &mut Account<'info, Agent>,
    config: &mut Account<'info, Config>,
    agent_vault: &Account<'info, TokenAccount>,
    buffer_vault: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    available: u64,
) -> Result<u64> {
    let amount = available.min(agent.debt);
    if amount == 0 {
        return Ok(0);
    }
    let id = agent.agent_id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"agent", agent.owner.as_ref(), &id, &[agent.bump]];
    token::transfer(
        CpiContext::new_with_signer(token_program.key(), Transfer {
            from: agent_vault.to_account_info(),
            to: buffer_vault.to_account_info(),
            authority: agent.to_account_info(),
        }, &[seeds]),
        amount,
    )?;
    agent.debt -= amount;
    config.outstanding_debt = config.outstanding_debt.saturating_sub(amount);
    Ok(amount)
}

#[derive(Accounts)]
#[instruction(payment_id: [u8; 32])]
pub struct Pay<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, constraint = agent.signer == signer.key() @ UnsleptError::NotSigner)]
    pub agent: Account<'info, Agent>,
    #[account(mut, seeds = [b"agent_vault", agent.key().as_ref()], bump = agent.vault_bump)]
    pub agent_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"buffer_vault"], bump = config.vault_bump)]
    pub buffer_vault: Account<'info, TokenAccount>,
    #[account(mut, address = config.params.treasury, token::mint = config.usdc_mint)]
    pub treasury: Account<'info, TokenAccount>,
    #[account(mut, token::mint = config.usdc_mint)]
    pub payee_token: Account<'info, TokenAccount>,
    #[account(
        init, payer = signer, space = 8 + Payment::INIT_SPACE,
        seeds = [b"payment", payment_id.as_ref()], bump,
    )]
    pub payment: Account<'info, Payment>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Settles one x402 payment. The buffer pays the merchant at once; the agent repays the buffer from its liquid USDC in
/// the same transaction, and any remainder stays as debt backed by the agent's yield position.
pub fn pay(mut ctx: Context<Pay>, payment_id: [u8; 32], amount: u64, endpoint_hash: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;
    let a = &mut ctx.accounts;
    require!(!a.config.paused, UnsleptError::ProtocolPaused);
    require!(!a.agent.revoked, UnsleptError::AgentRevoked);
    require!(!a.agent.paused, UnsleptError::AgentPaused);
    require!(amount > 0, UnsleptError::ZeroAmount);
    require!(amount <= a.agent.per_call_cap, UnsleptError::PerCallCapExceeded);

    let today = clock.unix_timestamp / 86_400;
    let spent = if a.agent.spend_day == today { a.agent.spent_today } else { 0 };
    let new_spent = spent.checked_add(amount).ok_or(error!(UnsleptError::Overflow))?;
    require!(new_spent <= a.agent.daily_cap, UnsleptError::DailyCapExceeded);
    require!(a.agent.payee_allowed(&a.payee_token.owner), UnsleptError::PayeeNotAllowed);
    require!(a.buffer_vault.amount >= amount, UnsleptError::InsufficientLiquidity);

    let fee = ((amount as u128) * (a.config.params.fee_bps as u128) / (BPS as u128)) as u64;
    require!(a.agent_vault.amount >= fee, UnsleptError::InsufficientCollateral);

    // 1. The buffer pays the merchant.
    let cseeds: &[&[u8]] = &[b"config", &[a.config.bump]];
    token::transfer(
        CpiContext::new_with_signer(a.token_program.key(), Transfer {
            from: a.buffer_vault.to_account_info(),
            to: a.payee_token.to_account_info(),
            authority: a.config.to_account_info(),
        }, &[cseeds]),
        amount,
    )?;
    a.agent.debt = a.agent.debt.checked_add(amount).ok_or(error!(UnsleptError::Overflow))?;
    a.config.outstanding_debt = a.config.outstanding_debt.checked_add(amount).ok_or(error!(UnsleptError::Overflow))?;

    // 2. The settlement fee goes to the treasury from the agent's liquid USDC.
    if fee > 0 {
        let id = a.agent.agent_id.to_le_bytes();
        let aseeds: &[&[u8]] = &[b"agent", a.agent.owner.as_ref(), &id, &[a.agent.bump]];
        token::transfer(
            CpiContext::new_with_signer(a.token_program.key(), Transfer {
                from: a.agent_vault.to_account_info(),
                to: a.treasury.to_account_info(),
                authority: a.agent.to_account_info(),
            }, &[aseeds]),
            fee,
        )?;
    }

    // 3. The agent repays what it can right away; the rest must be covered by its yield position.
    let liquid = a.agent_vault.amount.saturating_sub(fee);
    let repaid = repay_from_vault(&mut a.agent, &mut a.config, &a.agent_vault, &a.buffer_vault, &a.token_program, liquid)?;
    require!(a.agent.debt <= a.agent.max_debt(), UnsleptError::InsufficientCollateral);

    a.agent.spend_day = today;
    a.agent.spent_today = new_spent;
    a.agent.payments = a.agent.payments.saturating_add(1);

    let p = &mut a.payment;
    p.payment_id = payment_id;
    p.agent = a.agent.key();
    p.payee = a.payee_token.owner;
    p.amount = amount;
    p.fee = fee;
    p.endpoint_hash = endpoint_hash;
    p.slot = clock.slot;
    p.ts = clock.unix_timestamp;
    p.rent_payer = a.signer.key();
    p.bump = ctx.bumps.payment;

    emit!(Settled {
        payment_id,
        agent: a.agent.key(),
        payee: a.payee_token.owner,
        amount,
        fee,
        fronted: amount - repaid.min(amount),
        endpoint_hash,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClosePayment<'info> {
    /// CHECK: receives the rent back; must be the account that paid it.
    #[account(mut, address = payment.rent_payer)]
    pub rent_payer: UncheckedAccount<'info>,
    #[account(mut, close = rent_payer)]
    pub payment: Account<'info, Payment>,
}

/// Anyone can close a payment record 24 hours after settlement; the rent returns to whoever paid it.
pub fn close_payment(ctx: Context<ClosePayment>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.payment.ts + PAYMENT_RECORD_TTL, UnsleptError::RecordTooYoung);
    Ok(())
}
