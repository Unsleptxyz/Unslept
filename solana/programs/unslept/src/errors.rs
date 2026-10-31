use anchor_lang::prelude::*;

#[error_code]
pub enum UnsleptError {
    #[msg("The protocol is paused.")]
    ProtocolPaused,
    #[msg("Only the admin can do this.")]
    NotAdmin,
    #[msg("Only the pauser or admin can do this.")]
    NotPauser,
    #[msg("Only the agent owner can do this.")]
    NotOwner,
    #[msg("Only the agent signer can request payments.")]
    NotSigner,
    #[msg("Fee above the 1% maximum.")]
    FeeTooHigh,
    #[msg("No parameter change is pending, or its delay has not passed.")]
    NotReady,
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Deposit would exceed the buffer cap.")]
    CapExceeded,
    #[msg("The buffer does not hold enough liquid USDC right now.")]
    InsufficientLiquidity,
    #[msg("The agent is paused by its owner.")]
    AgentPaused,
    #[msg("The agent was revoked by its owner.")]
    AgentRevoked,
    #[msg("Payment above the per-call cap.")]
    PerCallCapExceeded,
    #[msg("Payment would exceed the daily cap.")]
    DailyCapExceeded,
    #[msg("The payee is not on the agent's allowlist.")]
    PayeeNotAllowed,
    #[msg("The agent cannot cover this payment: not enough USDC and yield position.")]
    InsufficientCollateral,
    #[msg("Allowlist holds at most 8 payees.")]
    AllowlistTooLong,
    #[msg("Withdrawal would leave the agent's debt uncovered.")]
    WouldLeaveDebtUncovered,
    #[msg("Payment records can be closed 24 hours after settlement.")]
    RecordTooYoung,
    #[msg("Token account mint does not match USDC.")]
    WrongMint,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("The yield reserve is already set.")]
    YieldReserveAlreadySet,
    #[msg("No yield reserve is configured.")]
    YieldReserveNotSet,
    #[msg("Only the owner or the keeper can do this.")]
    NotOwnerOrKeeper,
    #[msg("Not enough yield position.")]
    InsufficientPosition,
}
