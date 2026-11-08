# PROJECT_STATE.md — IntentGuard Verified State

**Last Updated:** November 7, 2026
**Status:** Deployed and verified on Devnet. Proof B1-B11 and the real Phantom owner flow are complete. Remaining: demo video and Devpost submission.

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
| Deployer (public) | `4rmC4HUKu3fcLdbYLAGwTyRnjwCgncVnv8yu2yz26h8F` | 0.76791312 SOL, including 0.01 SOL received as the owner vault's approved recipient. Deployment and proof spend: 1.24208688 SOL of the approved 1.30 |
| Agent (public) | `9HCi3TLstMPCFMthxD1EBeaXqf1ALZQg24jrSyih2Dzy` | 0.0170186 SOL |
| Program ID | `HUcVUeiiuJhTmzDzJDEgJ7tkejGmmKFTapaXvLVvkjcE` | Deployed to Devnet, executable, on-chain bytes match SHA-256 `ba3170f3...a312`. Deploy tx `5cmrscNwBJt1bYuEUmLj1QVEds15nZyX6pcHx4FRPvg14xz4BSsuvkvrkzRGVHTsydERuf3feMkPcCiBmbUaJZLU` |

## 3. Milestones

- [x] **M1 Smart contract:** `anchor build` succeeds.
- [x] **M2 Contract tests:** 32 of 32 pass on a local validator (`anchor test --validator legacy`).
- [x] **M3 Devnet deployment:** Deployed and independently verified (program exists, executable, upgrade authority is the deployer, on-chain bytes identical to the approved binary). The first CLI upload stalled on public RPC rate limits; the existing buffer was completed with a throttled writer and deployed with the official CLI.
- [x] **M3 Devnet proof:** B1-B11 all match their expected on-chain results (re-verified from chain). The first run stopped after B7 on a client-side error-handling bug, since fixed; B8-B11 ran via `backend/scripts/devnet-proof-continue.ts`. Record: `docs/devnet-proof.json`.
- [x] **M4 Backend and AI:** Live on Devnet: real Gemini parsed requests, the agent proposed, and a prompt-injected 5 SOL request was rejected on-chain (tx `35u96Vk5...8nGKyso`). Earlier notes: Real Gemini verified: 7 of 7 live cases passed on `gemini-3.5-flash` through `backend/scripts/gemini-check.ts`. 9 of 9 validation tests pass. The live route from Gemini to a Devnet proposal is untested until M3.
- [x] **M5 Frontend:** Real Phantom owner flow on Devnet: create vault, deposit 0.5 SOL, Gemini proposal, owner approval (tx `3MG4XChs...SzATV9oM`), over-limit request blocked (tx `3mhXjRkG...JAL8qEGw`), refresh and reconnect. Earlier notes: Typecheck and build pass. The UI flow passed in a headless browser against a local validator, using a test-only wallet and fixed intents. **Real Phantom on Devnet is untested.**
- [x] **M6 End-to-end:** Complete on Devnet with real Gemini and real Phantom (see README).
- [~] **M7 QA and submission:** Code audit fixes applied and tested, README and screenshots final, repository pushed. Remaining: demo video and Devpost submission.

## 4. Remaining (needs the owner)

1. Record the 2-minute demo video (steps in `docs/SUBMISSION.md`).
2. Submit on Devpost with the repository, video and Program ID.

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
