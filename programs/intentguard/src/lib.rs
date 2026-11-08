pub mod errors;
pub mod state;

use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub use errors::IntentGuardError;
pub use state::*;

declare_id!("HUcVUeiiuJhTmzDzJDEgJ7tkejGmmKFTapaXvLVvkjcE");

/// Lamports the vault can spend while remaining rent-exempt.
fn liquid_lamports(vault: &AccountInfo) -> Result<u64> {
    let rent_minimum = Rent::get()?.minimum_balance(vault.data_len());
    Ok(vault.lamports().saturating_sub(rent_minimum))
}

#[program]
pub mod intentguard {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        authorized_agent: Pubkey,
        approved_recipient: Pubkey,
        max_amount_lamports: u64,
    ) -> Result<()> {
        require!(max_amount_lamports > 0, IntentGuardError::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.authorized_agent = authorized_agent;
        vault.approved_recipient = approved_recipient;
        vault.max_amount_lamports = max_amount_lamports;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        require!(amount > 0, IntentGuardError::InvalidAmount);

        system_program::transfer(
            CpiContext::new(
                System::id(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )
    }

    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        new_authorized_agent: Option<Pubkey>,
        new_approved_recipient: Option<Pubkey>,
        new_max_amount: Option<u64>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        if let Some(agent) = new_authorized_agent {
            vault.authorized_agent = agent;
        }
        if let Some(recipient) = new_approved_recipient {
            vault.approved_recipient = recipient;
        }
        if let Some(max_amount) = new_max_amount {
            require!(max_amount > 0, IntentGuardError::InvalidAmount);
            vault.max_amount_lamports = max_amount;
        }
        Ok(())
    }

    pub fn propose_payment(
        ctx: Context<ProposePayment>,
        amount: u64,
        recipient: Pubkey,
        intent_hash: [u8; 32],
    ) -> Result<()> {
        let vault = &ctx.accounts.vault;
        require!(amount > 0, IntentGuardError::InvalidAmount);
        require_keys_eq!(
            recipient,
            vault.approved_recipient,
            IntentGuardError::UnapprovedRecipient
        );
        require!(
            amount <= vault.max_amount_lamports,
            IntentGuardError::AmountExceedsPolicyLimit
        );
        require!(
            amount <= liquid_lamports(&vault.to_account_info())?,
            IntentGuardError::InsufficientVaultBalance
        );

        let vault_key = vault.key();
        let proposal = &mut ctx.accounts.proposal;

        // A freshly created account has a zeroed vault field. An existing one must
        // be resolved first, so a pending proposal can't be swapped during review.
        let is_new = proposal.vault == Pubkey::default();
        require!(
            is_new || proposal.status != ProposalStatus::Pending,
            IntentGuardError::PendingProposalExists
        );

        proposal.vault = vault_key;
        proposal.agent = ctx.accounts.agent.key();
        proposal.recipient = recipient;
        proposal.amount = amount;
        proposal.intent_hash = intent_hash;
        proposal.status = ProposalStatus::Pending;
        proposal.created_at = Clock::get()?.unix_timestamp;
        proposal.bump = ctx.bumps.proposal;
        proposal.nonce = proposal
            .nonce
            .checked_add(1)
            .ok_or(IntentGuardError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn approve_and_execute_payment(
        ctx: Context<ApproveAndExecutePayment>,
        expected_nonce: u64,
    ) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let proposal = &ctx.accounts.proposal;

        require!(
            proposal.status == ProposalStatus::Pending,
            IntentGuardError::ProposalNotPending
        );
        require!(
            proposal.nonce == expected_nonce,
            IntentGuardError::StaleProposal
        );

        // The owner may have changed the policy after this proposal was created,
        // for example to replace a compromised agent.
        require_keys_eq!(
            proposal.agent,
            vault.authorized_agent,
            IntentGuardError::UnauthorizedAgent
        );
        require_keys_eq!(
            proposal.recipient,
            vault.approved_recipient,
            IntentGuardError::UnapprovedRecipient
        );
        require!(
            proposal.amount <= vault.max_amount_lamports,
            IntentGuardError::AmountExceedsPolicyLimit
        );
        require!(
            proposal.amount <= liquid_lamports(&vault.to_account_info())?,
            IntentGuardError::InsufficientVaultBalance
        );

        let amount = proposal.amount;
        ctx.accounts.proposal.status = ProposalStatus::Executed;

        // The vault is owned by this program, so it can debit lamports directly.
        ctx.accounts.vault.sub_lamports(amount)?;
        ctx.accounts.recipient.add_lamports(amount)?;
        Ok(())
    }

    pub fn reject_payment(ctx: Context<RejectPayment>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(
            proposal.status == ProposalStatus::Pending,
            IntentGuardError::ProposalNotPending
        );
        proposal.status = ProposalStatus::Rejected;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

// In the contexts below, seeds use `vault.owner` rather than `owner.key()`. A wrong
// signer then fails `has_one` with UnauthorizedOwner, not a generic seeds error.
#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        has_one = owner @ IntentGuardError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        has_one = owner @ IntentGuardError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ProposePayment<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.authorized_agent == agent.key() @ IntentGuardError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    // Safe use of init_if_needed: the address is fixed by the seeds, and the handler
    // refuses to overwrite a pending proposal.
    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + PaymentProposal::INIT_SPACE,
        seeds = [PROPOSAL_SEED, vault.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, PaymentProposal>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveAndExecutePayment<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        has_one = owner @ IntentGuardError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [PROPOSAL_SEED, vault.key().as_ref()],
        bump = proposal.bump,
        has_one = vault @ IntentGuardError::InvalidProposalVault
    )]
    pub proposal: Account<'info, PaymentProposal>,

    #[account(mut, address = proposal.recipient @ IntentGuardError::InvalidRecipientAccount)]
    pub recipient: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct RejectPayment<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        has_one = owner @ IntentGuardError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [PROPOSAL_SEED, vault.key().as_ref()],
        bump = proposal.bump,
        has_one = vault @ IntentGuardError::InvalidProposalVault
    )]
    pub proposal: Account<'info, PaymentProposal>,
}
