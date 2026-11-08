/**
 * Proves the on-chain rules with real transactions, using the CLI wallet as the owner.
 *
 *   Local:  RPC_URL=http://127.0.0.1:8899 npx tsx scripts/devnet-proof.ts
 *   Devnet: PROOF_RECIPIENT=<wallet> npx tsx scripts/devnet-proof.ts
 *
 * Moves at most 0.127 SOL out of the CLI wallet, and only on Devnet or a local validator.
 * Writes signatures (never keys) to docs/devnet-proof.json on Devnet.
 */
import "../src/network.js";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import anchor from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AgentChain, loadKeypair, type ProposalOutcome } from "../src/solana.js";

const { AnchorProvider, BN, Program, Wallet } = anchor;

const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(rpc);
const sol = (n: number) => Math.round(n * LAMPORTS_PER_SOL);

const owner = loadKeypair(`${homedir()}/.config/solana/id.json`);
const agent = loadKeypair(process.env.AGENT_KEYPAIR_PATH ?? "./agent-keypair.json");
const rogue = Keypair.generate();
if (!isLocal && !process.env.PROOF_RECIPIENT) {
  throw new Error("Refusing to run on Devnet: set PROOF_RECIPIENT to the intended wallet.");
}
const recipient = new PublicKey(
  process.env.PROOF_RECIPIENT ?? Keypair.generate().publicKey.toBase58()
);

const chain = new AgentChain(rpc, agent);
const rogueChain = new AgentChain(rpc, rogue);
if (!isLocal) await chain.assertDevnet();

const connection = chain.connection;
const ownerProvider = new AnchorProvider(connection, new Wallet(owner), { commitment: "confirmed" });
const program = new Program(chain.program.idl, ownerProvider);
const programId = program.programId;
const accounts = program.account as any;

const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), owner.publicKey.toBuffer()], programId);
const proposal = chain.proposalAddress(vault);
const hash = (text: string) => createHash("sha256").update(text).digest();

type Row = { step: string; expected: string; actual: string; passed: boolean; signature: string; explorerUrl: string };
const rows: Row[] = [];

function record(step: string, expected: string, outcome: ProposalOutcome) {
  const actual = outcome.error ? outcome.error.name : "success";
  const passed = actual === expected;
  rows.push({ step, expected, actual, passed, signature: outcome.signature, explorerUrl: outcome.explorerUrl });
  console.log(`${passed ? "PASS" : "FAIL"}  ${step}: ${actual}\n      ${outcome.explorerUrl}`);
  if (!passed) throw new Error(`Unexpected result for "${step}".`);
}

const asOwner = (tx: Promise<Transaction>) => tx.then((t) => chain.sendAndReport(t, owner));

const execute = (nonce: number) =>
  asOwner(
    program.methods
      .approveAndExecutePayment(new BN(nonce))
      .accountsPartial({ owner: owner.publicKey, vault, proposal, recipient })
      .transaction()
  );

async function fund(to: PublicKey, lamports: number) {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: to, lamports }));
  const outcome = await chain.sendAndReport(tx, owner);
  if (outcome.error) throw new Error(`Funding failed: ${outcome.error.message}`);
}

if (!isLocal) {
  // Pre-flight checks. Nothing has been signed or sent at this point.
  if (await accounts.vault.fetchNullable(vault)) {
    throw new Error("Refusing to run: the proof vault already exists, and a re-run spends about 0.125 SOL more.");
  }
  const available = await connection.getBalance(owner.publicKey, "confirmed");
  if (available < sol(0.13)) {
    throw new Error(`Refusing to run: the deployer holds ${available / LAMPORTS_PER_SOL} SOL and needs 0.13 SOL.`);
  }
}

if (isLocal) {
  const signature = await connection.requestAirdrop(owner.publicKey, sol(10));
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
}

console.log(`Network: ${isLocal ? "local validator" : "Devnet"}`);
console.log(`Program: ${programId.toBase58()}\nVault:   ${vault.toBase58()}\n`);

const LIMIT = sol(0.05);
const PAYMENT = sol(0.01);

if (await accounts.vault.fetchNullable(vault)) {
  // Safe to re-run: reuse the vault, point it at this run's agent and recipient.
  const outcome = await asOwner(
    program.methods
      .updatePolicy(agent.publicKey, recipient, new BN(LIMIT))
      .accountsPartial({ owner: owner.publicKey, vault })
      .transaction()
  );
  record("Owner resets the policy on the existing vault", "success", outcome);
  const existing = await accounts.paymentProposal.fetchNullable(proposal);
  if (existing && "pending" in existing.status) {
    record(
      "Owner clears a leftover pending proposal",
      "success",
      await asOwner(
        program.methods
          .rejectPayment()
          .accountsPartial({ owner: owner.publicKey, vault, proposal })
          .transaction()
      )
    );
  }
} else {
  record(
    "Owner creates the vault",
    "success",
    await asOwner(
      program.methods
        .initializeVault(agent.publicKey, recipient, new BN(LIMIT))
        .accountsPartial({ owner: owner.publicKey, vault })
        .transaction()
    )
  );
}

record(
  "Owner deposits 0.1 SOL",
  "success",
  await asOwner(
    program.methods
      .depositSol(new BN(sol(0.1)))
      .accountsPartial({ owner: owner.publicKey, vault })
      .transaction()
  )
);

// Fee money only. Neither key gets any authority from this.
await fund(agent.publicKey, sol(0.02));
await fund(rogue.publicKey, sol(0.005));

const propose = (who: AgentChain, lamports: number, to: PublicKey, label: string) =>
  who.propose({ vault, lamports: BigInt(lamports), recipient: to, intentHash: hash(label) });

record(
  "Over-limit proposal (0.5 SOL against a 0.05 SOL limit)",
  "AmountExceedsPolicyLimit",
  await propose(chain, sol(0.5), recipient, "over limit")
);
record(
  "Proposal to an unapproved recipient",
  "UnapprovedRecipient",
  await propose(chain, PAYMENT, rogue.publicKey, "bad recipient")
);
record(
  "Proposal signed by an unauthorized agent",
  "UnauthorizedAgent",
  await propose(rogueChain, PAYMENT, recipient, "rogue agent")
);

const before = await connection.getBalance(recipient, "confirmed");
record("Authorized agent proposes 0.01 SOL", "success", await propose(chain, PAYMENT, recipient, "valid"));

const pending = await accounts.paymentProposal.fetch(proposal);
const nonce = pending.nonce.toNumber();

const unchanged = await connection.getBalance(recipient, "confirmed");
if (unchanged !== before) throw new Error("Funds moved before owner approval.");
console.log("PASS  No funds moved after the proposal alone");

record(
  "Agent tries to execute its own proposal",
  "UnauthorizedOwner",
  await chain.sendAndReport(
    await program.methods
      .approveAndExecutePayment(new BN(nonce))
      .accountsPartial({ owner: agent.publicKey, vault, proposal, recipient })
      .transaction(),
    agent
  )
);

record("Owner approves and executes", "success", await execute(nonce));
const after = await connection.getBalance(recipient, "confirmed");
if (after - before !== PAYMENT) throw new Error(`Recipient received ${after - before}, expected ${PAYMENT}.`);
console.log("PASS  Recipient received exactly 0.01 SOL");

record("Replay: execute the same proposal again", "ProposalNotPending", await execute(nonce));

console.log(`\nAll ${rows.length} on-chain steps behaved as expected.`);
if (!isLocal) {
  const proof = {
    network: "devnet",
    programId: programId.toBase58(),
    vault: vault.toBase58(),
    recipient: recipient.toBase58(),
    ranAt: new Date().toISOString(),
    rows,
  };
  writeFileSync(new URL("../../docs/devnet-proof.json", import.meta.url), JSON.stringify(proof, null, 2));
  console.log("Saved docs/devnet-proof.json");
}
