use anchor_lang::prelude::*;

pub const VAULT_SEED: &[u8] = b"vault";
pub const PROPOSAL_SEED: &[u8] = b"proposal";

/// Holds the owner's SOL and the spending policy.
/// PDA seeds: [b"vault", owner]
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub authorized_agent: Pubkey,
    pub approved_recipient: Pubkey,
    pub max_amount_lamports: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ProposalStatus {
    Pending,
    Executed,
    Rejected,
}

/// The vault's single proposal slot, reused once the previous proposal is resolved.
/// PDA seeds: [b"proposal", vault]
#[account]
#[derive(InitSpace)]
pub struct PaymentProposal {
    pub vault: Pubkey,
    pub agent: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub intent_hash: [u8; 32],
    pub status: ProposalStatus,
    pub created_at: i64,
    pub bump: u8,
    /// Starts at 1 and increases with every new proposal. The owner's approval
    /// names the nonce they reviewed, so it can never apply to a later proposal.
    pub nonce: u64,
}
