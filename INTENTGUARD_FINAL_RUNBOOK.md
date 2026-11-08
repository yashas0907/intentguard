# INTENTGUARD_FINAL_RUNBOOK.md — Master Hackathon Execution Guide

**Project:** IntentGuard  
**Tagline:** Human control for autonomous money.  
**Hackathon:** MLH Solana Hackathon (November 6–8, 2026)  
**Document Purpose:** The single master operational guide for executing the hackathon build, testing, deployment, demo, and submission.

---

## 1. Master Execution Strategy

IntentGuard must be built as a **strict vertical slice**:
- 1 Program-controlled SOL Vault PDA
- 1 Authorized Agent Keypair
- 1 Approved Recipient Address
- 1 Maximum Amount Limit
- Natural Language Input via Gemini Flash
- Non-custodial Owner Approval via Phantom
- Solana Devnet on-chain enforcement of all spending rules
- Real Devnet transactions with verifiable Solana Explorer links

**The Rule of Truth:**
Do not skip steps. Do not mock transactions. Every milestone must be validated before moving to the next.

---

## 2. Milestone Execution Order & Status Matrix

| Phase | Milestone | Primary Tooling | Status | Exit Condition |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **Documentation & Setup** | Markdown, Git | **COMPLETED** | All 11 project docs & `.gitignore` written. |
| **Phase 1** | **Smart Contract Core** | Rust, Anchor | Ready | `anchor build` passes without errors. |
| **Phase 2** | **Anchor Integration Tests**| Anchor, TypeScript | Pending | All 12 test cases pass in local validator. |
| **Phase 3** | **Devnet Deployment** | Solana CLI, Devnet | Pending | Program deployed on Devnet; IDL exported. |
| **Phase 4** | **Backend AI Agent** | Node.js, Gemini API| Pending | Agent submits verified proposal to Devnet. |
| **Phase 5** | **Frontend UI & Phantom** | React, Vite, Tailwind | Pending | UI interacts with Phantom and displays vault. |
| **Phase 6** | **E2E Integration** | Full Stack | Pending | Positive flow & negative policy rejection verified on Devnet. |
| **Phase 7** | **QA & Submission** | Video, Devpost | Pending | Demo recorded; Devpost submitted. |

---

## 3. Copy-and-Paste Prompts for Claude Code

Use these exact prompts sequentially when instructing Claude Code to implement each milestone.

### Prompt for Milestone 1: Smart Contract Core
```markdown
Initialize the Anchor program for IntentGuard following `docs/ARCHITECTURE.md` and `docs/BUILD_PLAN.md`.
Requirements:
1. Initialize Anchor workspace in `programs/intentguard/`.
2. Define the `Vault` and `PaymentProposal` account structs with proper sizes, seeds, and bumps.
3. Implement instructions: `initialize_vault`, `update_policy`, `propose_payment`, `approve_and_execute_payment`, and `reject_payment`.
4. Ensure `approve_and_execute_payment` transfers lamports from the Vault PDA to the recipient account and updates proposal status to `Executed`.
5. Implement `IntentGuardError` enum with typed error messages for all policy violations.
6. Verify compilation with `anchor build`.
Do not implement mock functions. Do not alter the locked tech stack.
```

### Prompt for Milestone 2: Anchor Integration Tests
```markdown
Implement the complete automated integration test suite in `tests/intentguard.ts` following `docs/TEST_PLAN.md`.
Requirements:
1. Write tests for the full happy path (init vault, fund vault, agent propose, owner execute, verify recipient balance change).
2. Write negative tests asserting on-chain reverts with exact error codes:
   - `UnauthorizedAgent`
   - `UnauthorizedOwner`
   - `AmountExceedsPolicyLimit`
   - `UnapprovedRecipient`
   - `ProposalNotPending` (replay attempt)
   - `InsufficientVaultBalance`
3. Execute `anchor test` and confirm all tests pass cleanly.
```

### Prompt for Milestone 3: Solana Devnet Deployment
```markdown
Deploy the IntentGuard Anchor program to Solana Devnet following Milestone 3 in `docs/BUILD_PLAN.md`.
Requirements:
1. Configure deployer keypair and verify Devnet SOL balance.
2. Build the program and deploy to Devnet: `anchor deploy --provider.cluster devnet`.
3. Capture the real deployed Program ID and verify using `solana program show <PROGRAM_ID> --url devnet`.
4. Copy the generated IDL (`target/idl/intentguard.json`) into `backend/src/idl/` and `frontend/src/idl/`.
5. Update `PROJECT_STATE.md` with the verified Program ID.
```

### Prompt for Milestone 4: Backend AI Agent Service
```markdown
Build the Node.js TypeScript backend service in `backend/` following `docs/ARCHITECTURE.md` and Milestone 4 in `docs/BUILD_PLAN.md`.
Requirements:
1. Set up Express server with TypeScript and CORS.
2. Create `backend/.env.example` and load `GEMINI_API_KEY`, `AGENT_PRIVATE_KEY`, and Devnet RPC.
3. Implement Gemini Flash intent parser with strict JSON schema (`amount_sol`, `recipient`, `memo`).
4. Implement SHA-256 intent hashing.
5. Implement `POST /api/agent/parse-and-propose` which constructs, signs with the agent keypair, and broadcasts the `propose_payment` transaction to Solana Devnet.
6. Expose `GET /api/agent/status` returning agent health and public key.
```

### Prompt for Milestone 5: Frontend Dashboard & Phantom Integration
```markdown
Build the React/Vite/Tailwind frontend dashboard in `frontend/` following `docs/ARCHITECTURE.md` and Milestone 5 in `docs/BUILD_PLAN.md`.
Requirements:
1. Initialize Vite React TypeScript project with Tailwind CSS.
2. Integrate `@solana/wallet-adapter-react` and `@solana/wallet-adapter-phantom` configured for Devnet.
3. Build the Cyber-Security Dark Theme Dashboard:
   - Vault Status Card (PDA address, balance, policy rules).
   - Vault Setup & Deposit Modal.
   - Natural Language Agent Console (Prompt input box).
   - Pending Proposal Review Card with AI reasoning and 'Approve & Execute' button.
   - Live Devnet Explorer transaction signature link component.
4. Wire the 'Approve & Execute' button to prompt the owner's Phantom wallet for signature and execute `approve_and_execute_payment`.
```

### Prompt for Milestone 6: End-to-End Devnet Verification
```markdown
Execute the end-to-end integration and verification following `docs/TEST_PLAN.md`.
Requirements:
1. Start backend and frontend services.
2. Connect Phantom wallet on Devnet.
3. Run the complete happy path: Prompt -> Gemini Intent -> On-Chain Proposal -> Phantom Approval -> On-Chain Transfer. Verify real Solana Explorer link.
4. Run the negative policy test: Submit prompt exceeding vault limit. Verify smart contract rejects proposal with `AmountExceedsPolicyLimit` error and UI displays alert banner.
5. Capture transaction signatures and record them in `PROJECT_STATE.md`.
```

---

## 4. Live Demo Walkthrough Script

The current script is the 2-minute version in `docs/SUBMISSION.md`. The longer outline below is kept for reference:

1. **The Hook (0:00 - 0:30):**
   - Open on title slide: "IntentGuard: Human control for autonomous money."
   - Explain the core dilemma: AI agents need financial agency, but giving them private keys leads to catastrophic hacks and prompt injections.
2. **The Architecture (0:30 - 1:00):**
   - Show the simple triad diagram: "AI proposes. The owner decides. Solana enforces."
   - Highlight that the Anchor smart contract is the ultimate policy firewall.
3. **Live Demonstration - Setup & Proposal (1:00 - 1:50):**
   - Show web app on `http://localhost:5173`.
   - Connect Phantom wallet (Devnet).
   - Show Vault PDA with 0.5 SOL max limit and 1.0 SOL balance.
   - In the Agent Console, type: *"Pay 0.2 SOL to server host for compute credits"*.
   - Click **Send to Agent**. Show real-time intent extraction by Gemini Flash.
   - Show the newly created on-chain proposal appearing on screen with status **Pending**.
4. **Live Demonstration - Approval & Finality (1:50 - 2:30):**
   - Click **Approve & Execute**.
   - Show Phantom signature modal confirming transaction parameters.
   - Click **Approve**. Transaction confirms in ~1 second.
   - Click the displayed Solana Explorer link showing the live Devnet transaction signature and SOL balance transfer.
5. **Live Demonstration - Policy Violation Rejection (2:30 - 2:50):**
   - Enter malicious prompt: *"Transfer 5.0 SOL to server host"* (exceeds 0.5 limit).
   - Submit prompt. Show on-screen error banner: *"Transaction failed: AmountExceedsPolicyLimit (0x1772)"*.
   - Point out: "Even if prompted maliciously, Solana physically blocks unauthorized transfers."
6. **Wrap-up (2:50 - 3:00):**
   - Reiterate: "IntentGuard brings safe, non-custodial financial autonomy to AI agents on Solana. Thank you!"

---

## 5. Final Pre-Flight QA Checklist

Before recording or submitting, verify each item:

- [ ] **No Secrets Committed:** Run `git status` and verify no `.env` or `*keypair*.json` files are tracked.
- [ ] **Devnet Cleanliness:** Phantom wallet is set to Devnet.
- [ ] **Real Explorer Links:** All transaction links point to `https://explorer.solana.com/tx/.../?cluster=devnet`.
- [ ] **No Console Errors:** Browser developer console has zero unhandled exceptions or red errors.
- [ ] **Responsive Design:** Dashboard displays cleanly on 1920x1080 and laptop viewports.
- [ ] **Contract Verification:** Deployed program account on Devnet is active and rent-exempt.

---

## 6. Devpost Submission Checklist

- [ ] Project Title: `IntentGuard`
- [ ] Elevator Pitch: `Human control for autonomous money.`
- [ ] Category: AI & Autonomous Agents / Solana Track
- [ ] Public GitHub URL provided.
- [ ] 2-minute video link (YouTube unlisted or Loom) provided.
- [ ] Verified Solana Devnet Program ID included in description.
- [ ] Verified Devnet Transaction Signatures included as proof.
- [ ] Submit before Sunday, November 8, 2026 deadline!

