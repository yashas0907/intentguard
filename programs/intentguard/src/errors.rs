use anchor_lang::prelude::*;

// Order matters: Anchor numbers these from 6000 (0x1770), and docs/TEST_PLAN.md
// references those codes. Only ever append new variants at the end.
#[error_code]
pub enum IntentGuardError {
    #[msg("The signer is not authorized to propose payments for this vault.")]
    UnauthorizedAgent,

    #[msg("Only the registered vault owner can perform this operation.")]
    UnauthorizedOwner,

    #[msg("The proposed payment amount exceeds the maximum configured policy limit.")]
    AmountExceedsPolicyLimit,

    #[msg("The requested recipient does not match the approved recipient address.")]
    UnapprovedRecipient,

    #[msg("The payment proposal is not in a pending state.")]
    ProposalNotPending,

    #[msg("The vault has insufficient liquid lamports to execute this payment.")]
    InsufficientVaultBalance,

    #[msg("Proposal does not belong to the specified vault.")]
    InvalidProposalVault,

    #[msg("The passed recipient account does not match the proposal recipient.")]
    InvalidRecipientAccount,

    #[msg("The amount must be greater than zero.")]
    InvalidAmount,

    #[msg("The proposal changed since the owner reviewed it.")]
    StaleProposal,

    #[msg("A pending proposal already exists; the owner must approve or reject it first.")]
    PendingProposalExists,

    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
