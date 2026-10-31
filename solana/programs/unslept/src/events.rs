use anchor_lang::prelude::*;

#[event]
pub struct Settled {
    pub payment_id: [u8; 32],
    pub agent: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub fronted: u64,
    pub endpoint_hash: [u8; 32],
}

#[event]
pub struct AgentCreated {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub signer: Pubkey,
    pub agent_id: u64,
}

#[event]
pub struct BufferDeposited {
    pub depositor: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct BufferWithdrawn {
    pub depositor: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct DebtRepaid {
    pub agent: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct ParamsProposed {
    pub params: crate::state::Params,
    pub eta: i64,
}

#[event]
pub struct ParamsApplied {
    pub params: crate::state::Params,
}
