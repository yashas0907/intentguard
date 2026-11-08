# PROJECT_STATE.md — IntentGuard Verified State

**Last Updated:** November 7, 2026
**Status:** Program deployed and verified on Devnet. Proof B1-B7 complete on Devnet; B8-B11 pending owner approval.

Only verified facts belong here. No signature or result in this file is fabricated.

---

## 1. Environment (verified in WSL2 Ubuntu)

| Tool | Version |
| :--- | :--- |
| Rust | 1.99.1 (the project pins 1.89.0 through `rust-toolchain.toml`, as Anchor generated) |
| Solana CLI | 3.1.10, platform-tools v1.52 |
| Anchor CLI | 1.1.2 |
| Node / npm | 24.10.0 / 11.6.1 |
| CLI network | `https://api.devnet.solana.com` |

## 2. Identifiers

| Item | Value | Status |
| :--- | :--- | :--- |
| Deployer (public) | `4rmC4HUKu3fcLdbYLAGwTyRnjwCgncVnv8yu2yz26h8F` | 0.75792312 SOL. Cumulative net spend 1.24207688 SOL of the approved 1.30 |
| Agent (public) | `9HCi3TLstMPCFMthxD1EBeaXqf1ALZQg24jrSyih2Dzy` | 0.01999 SOL |
| Program ID | `HUcVUeiiuJhTmzDzJDEgJ7tkejGmmKFTapaXvLVvkjcE` | Deployed to Devnet, executable, on-chain bytes match SHA-256 `ba3170f3...a312`. Deploy tx `5cmrscNwBJt1bYuEUmLj1QVEds15nZyX6pcHx4FRPvg14xz4BSsuvkvrkzRGVHTsydERuf3feMkPcCiBmbUaJZLU` |

## 3. Milestones

- [x] **M1 Smart contract:** `anchor build` succeeds.
- [x] **M2 Contract tests:** 32 of 32 pass on a local validator (`anchor test --validator legacy`).
- [x] **M3 Devnet deployment:** Deployed and independently verified (program exists, executable, upgrade authority is the deployer, on-chain bytes identical to the approved binary). The first CLI upload stalled on public RPC rate limits; the existing buffer was completed with a throttled writer and deployed with the official CLI.
- [~] **M3 Devnet proof:** B1-B7 passed on Devnet (B5 `AmountExceedsPolicyLimit`, B6 `UnapprovedRecipient`, B7 `UnauthorizedAgent`). The run then stopped on a client-side error-handling bug, now fixed. B8-B11 await approval via `backend/scripts/devnet-proof-continue.ts`.
- [~] **M4 Backend and AI:** Real Gemini verified: 7 of 7 live cases passed on `gemini-3.5-flash` through `backend/scripts/gemini-check.ts`. 9 of 9 validation tests pass. The live route from Gemini to a Devnet proposal is untested until M3.
- [~] **M5 Frontend:** Typecheck and build pass. The UI flow passed in a headless browser against a local validator, using a test-only wallet and fixed intents. **Real Phantom on Devnet is untested.**
- [ ] **M6 End-to-end:** Needs M3 and real Phantom.
- [ ] **M7 QA and submission:** Docs and 2-minute script prepared. Commit, public repo, video and Devpost remain.

## 4. Blockers (need the owner)

1. Consolidated approval for the airdrop, deployment, vault funding and proof transactions.
2. Confirmation in the dashboard that `AysYADsexZg9kydavXDbccTspYXmFw6zhwKta8pxDREy` is the connected Phantom wallet.
3. Approval before any Git commit, push or submission.

## 4a. Cost basis (calculated, not yet Devnet results)

Rent comes from `solana rent` on Devnet. Transaction counts and fees were measured on a local validator, whose rent is higher than Devnet's. Local totals are not Devnet costs.

| Item | SOL |
| :--- | :--- |
| Program data rent (219,053 bytes) | 1.11343948 |
| Program account rent | 0.00083312 |
| Deployment fees (230 transactions) | 0.00115 |
| **Deployment total** | **1.1154226** |
| Proof: deposit, agent and rogue funding, vault rent, 6 fees | 0.12625428 |
| **Deployer total** | **1.24167688** |

## 4a. Operational facts

- **Gemini free tier:** 20 requests per day, per model (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, read from Google's 429 response). `gemini-2.5-flash` reached this limit on November 7, 2026. Keep requests for rehearsal and recording. `backend/.env` uses `gemini-3.5-flash`, and `GEMINI_MODEL` changes it. `gemini-2.5-flash-lite` is unavailable to new users.
- **Network:** About 10-15% of connections from this WSL environment timed out during testing. `backend/src/network.ts` and the backend's retries handle this. Have a backup connection for the live demo.

## 5. Decisions where documents conflicted

| Conflict | Decision |
| :--- | :--- |
| Anchor 0.30 in docs, 1.1.2 installed | Use installed 1.1.2 and `@anchor-lang/core` |
| Backend pre-checks policy vs. program must block | Backend checks format only. Policy violations go on-chain and fail there |
| Mock AI fallback in earlier risk notes vs. no fake AI | No fallback. AI failures are reported as failures |
| 3-minute video in docs, 2-minute in the master prompt | 2 minutes |
| Proposal "resets" on each propose | Added `PendingProposalExists` and a `nonce` to block swaps during review |
| `deposit_sol` mentioned but not specified | Implemented as an owner-signed instruction |
| `update_policy` missing from CLAUDE.md's list | Implemented, as the other documents require |
| "Immutable" contract claims | Removed. The program is upgradable by the deployer |
| `AGENT_PRIVATE_KEY` in env | Replaced with a Git-ignored keypair file path |

## 6. Known limitations

See "Known Limitations" in `docs/SECURITY.md`.
