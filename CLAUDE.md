# CLAUDE.md — IntentGuard Operational Guide for Claude Code

## Project Identity
- **Project Name:** IntentGuard
- **Event:** MLH Solana Hackathon (November 6–8, 2026)
- **Tagline:** Human control for autonomous money.
- **Core Principle:** AI proposes. The owner decides. Solana enforces.

---

## Mission & Goal
AI agents are increasingly autonomous and capable of generating financial transactions. Granting an AI agent direct access to private keys or arbitrary execution rights over funds is a catastrophic security vulnerability. 

**IntentGuard solves this by enforcing an architectural barrier:**
1. AI agents can **only propose** payments within strict on-chain guardrails.
2. The human owner retains **sole authorization power** via Phantom wallet.
3. The Solana smart contract **independently validates and enforces** spending policy at runtime before a single lamport leaves the vault.

---

## Locked Technology Stack
You must strictly adhere to this technology stack. Do not introduce alternative frameworks or libraries:
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, `@solana/web3.js`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-phantom`.
- **Blockchain:** Solana Devnet.
- **Smart Contract:** Rust, Anchor Framework.
- **Wallet:** Phantom Wallet (Browser Extension).
- **Backend:** Node.js (TypeScript, Express).
- **AI Integration:** Server-side Google Gemini Flash API (`@google/genai` or `@google/generative-ai`), strictly isolated to the backend service.

---

## Scope Restrictions (Strict Vertical Slice)
Build **one complete, flawless vertical slice**. You are forbidden from building features outside this scope:
- **DO NOT** implement multiple agents (only 1 authorized agent keypair).
- **DO NOT** implement multiple recipients (only 1 whitelisted recipient address).
- **DO NOT** implement SPL token transfers (native SOL only).
- **DO NOT** implement analytics dashboards, activity charts, or graphing libraries.
- **DO NOT** implement push notifications, Discord/Telegram webhooks, or email alerts.
- **DO NOT** implement cumulative daily/weekly spending counters or complex sliding windows.
- **DO NOT** implement persistent SQL/NoSQL databases (use on-chain state and transient in-memory backend session state).
- **DO NOT** add speculative features that put hackathon completion at risk.

---

## Security Invariants (Non-Negotiable)
1. **AI Never Signs:** The AI model or prompt parser must never have access to private keys and must never sign or execute blockchain transactions.
2. **Agent Capability Ceiling:** The backend agent keypair can ONLY sign the `propose_payment` instruction. It has zero mathematical or programmatic authority to release vault funds.
3. **Owner Sovereignty:** Only the human vault owner, signing through Phantom, can execute `approve_and_execute_payment` or modify vault parameters.
4. **On-Chain Policy Enforcement:** The Solana smart contract must independently verify that:
   - The proposer is the registered `authorized_agent`.
   - The recipient matches the registered `approved_recipient`.
   - The transfer amount does not exceed `max_amount_lamports`.
   - The proposal has not already been executed or cancelled.
   Front-end or off-chain checks are purely advisory; the smart contract is the final source of truth.
5. **No Secret Leakage:**
   - Never commit `.env`, `id.json`, or keypair JSON files.
   - Never prefix secret API keys or agent private keys with `VITE_`.
   - Client applications must only receive public keys and sanitized proposal payloads.
6. **No Mocked Blockchain Activity:**
   - Never fabricate transaction signatures, Explorer links, or mock confirmation states.
   - Every transaction shown in the UI must exist on Solana Devnet.

---

## Implementation Sequence
When tasked with code implementation, follow this strict milestone order:

1. **Milestone 1: Smart Contract Core (Rust / Anchor)**
   - Define state structs (`Vault`, `PaymentProposal`).
   - Implement `initialize_vault`, `propose_payment`, `approve_and_execute_payment`, `reject_payment`.
   - Implement custom error codes for policy violations.
2. **Milestone 2: Anchor Test Suite**
   - Write comprehensive TypeScript integration tests on local validator.
   - Test successful end-to-end proposal and execution.
   - Test rejection of unauthorized agent proposing.
   - Test rejection of non-owner attempting execution.
   - Test rejection of transfer exceeding `max_amount_lamports`.
   - Test rejection of unapproved recipient.
   - Test double-execution / replay prevention.
3. **Milestone 3: Devnet Program Deployment**
   - Build Anchor program (`anchor build`).
   - Deploy program to Solana Devnet (`anchor deploy --provider.cluster devnet`).
   - Export generated IDL and TypeScript types.
4. **Milestone 4: Backend AI Agent Service**
   - Implement Node.js TypeScript server.
   - Integrate Gemini Flash API with structured JSON output schema (recipient, amount, reasoning).
   - Validate AI output against vault parameters.
   - Sign and submit `propose_payment` transaction on Devnet using agent keypair.
5. **Milestone 5: Frontend UI & Phantom Integration**
   - Build clean dashboard: Vault Setup, Policy Configuration, Natural Language Agent Console, Pending Approvals, Devnet Explorer Feed.
   - Connect Phantom wallet via Solana Wallet Adapter.
   - Build interaction flows: Create Vault, Deposit SOL, Review Proposed Payment, Sign Execution via Phantom.
6. **Milestone 6: End-to-End Integration & Edge Case Verification**
   - Full live run on Solana Devnet.
   - Verification of positive case (valid prompt -> proposal -> owner approval -> transfer on Devnet).
   - Verification of negative case (over-limit prompt -> proposal rejected by policy).

---

## Protocol for Reporting Progress
- **Honesty First:** Never mark a task as completed without verifying the artifact or command output.
- **No Hallucinated Hashes:** If a program is not deployed, say "Not yet deployed". Never display dummy base58 signatures as real transactions.
- **Failures are Informative:** If an Anchor build fails or a Devnet airdrop fails, report the exact error, diagnose the root cause, and apply the targeted fix.
- **Refer to Single Source of Truth:** Keep `PROJECT_STATE.md` updated with strictly verified facts.

