/**
 * Completes the Devnet proof from B8 after the first run (devnet-proof.ts) stopped at B7
 * because of a client-side error-handling bug. B1-B7 already ran and are verified here
 * from their on-chain records instead of being sent again.
 *
 *   PROOF_RECIPIENT=<wallet> npx tsx scripts/devnet-proof-continue.ts
 *
 * Fails closed: if the vault, balances or history differ from what B1-B7 left behind,
 * it stops before sending anything.
 */
import "../src/network.js";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import anchor from "@anchor-lang/core";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { AgentChain, explorerTx, loadKeypair, type ProposalOutcome } from "../src/solana.js";

const { AnchorProvider, BN, Program, Wallet } = anchor;
const stop = (why: string): never => {
  console.log(`STOP: ${why}`);
  process.exit(1);
};

const START_BALANCE = 2_000_000_000;
const LIMIT = 1_300_000_000;
const PAYMENT = 10_000_000;
const EXPECTED_VAULT_LAMPORTS = 101_224_280;

if (!process.env.PROOF_RECIPIENT) stop("set PROOF_RECIPIENT");
const recipient = new PublicKey(process.env.PROOF_RECIPIENT!);
const owner = loadKeypair(`${homedir()}/.config/solana/id.json`);
const agent = loadKeypair(process.env.AGENT_KEYPAIR_PATH ?? "./agent-keypair.json");
const chain = new AgentChain("https://api.devnet.solana.com", agent);
await chain.assertDevnet();
const connection = chain.connection;
const program = new Program(chain.program.idl, new AnchorProvider(connection, new Wallet(owner), { commitment: "confirmed" }));
const accounts = program.account as any;
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), owner.publicKey.toBuffer()], program.programId);
const proposal = chain.proposalAddress(vault);

type Row = { step: string; expected: string; actual: string; passed: boolean; signature: string; explorerUrl: string };
const rows: Row[] = [];

// B1-B7: verified from the chain, never re-sent.
const earlier: [string, string, string][] = [
  ["B1 Owner creates the vault", "success", "5Zj64dGYH4ZAmst9mntWGHhRAfGvn62v7Lq9iTvGDow5dwkETJ6XkxnnE6ajTjEkBWKch7VZXigAYVuMGmJZB9dH"],
  ["B2 Owner deposits 0.1 SOL", "success", "48pD4whGLHkWGAEQMtrdco2mATAqfnYRR8bx1nQFRLSV9cobU5zs3CLqrwf6RmuhsoLaYdFr7hM8QCN5ty5qtyvj"],
  ["B3 Owner funds the agent with 0.02 SOL for fees", "success", "HTWdKS4KutLCgyi3YGxJrRoVFxjxNWQxrMckgEkpML6MBQsBwUKXMq2C2gGcWvhRcdz4HsXVfKuh8tVNfQqWRD1"],
  ["B4 Owner funds a rogue key with 0.005 SOL for fees", "success", "25Bp4mwyJaDU6UzaKxUCTYR8EWja9HzdQhsUPCpH6KrCqju1TmxhNUZvZM1gvsMQKV8qr6B9RG5wPzgVivfFa6Sd"],
  ["B5 Over-limit proposal (0.5 SOL against a 0.05 SOL limit)", "AmountExceedsPolicyLimit", "639HTcmyJBCsKxCT4NDXutK7RKvwe1ZUyCwkxBWQWEyLjjAQZ7pL657UMdmCVoWwzMuXZjuJJyYjiLPdeSPgUZV8"],
  ["B6 Proposal to an unapproved recipient", "UnapprovedRecipient", "2pieMUC5EfDzHN9SWHkUtBQcCXk83MzweD8Aky26X7WALzxXMLRbYvAbCHiCpJr4NXhhfWVSCmyHVWcdNnCSLzJ9"],
  ["B7 Proposal signed by an unauthorized agent", "UnauthorizedAgent", "4jpANJ2VR6rHxQjTB8PuwmuKCkkUXErCrhTF9sNEyDMjUvMqWE8QjwhSRE7167dPK94iCp5KvUtyWrmahPSnuCww"],
];
const errorName = (err: any) => {
  if (!err) return "success";
  const code = err?.InstructionError?.[1]?.Custom;
  return (chain.program.idl as any).errors?.find((e: any) => e.code === code)?.name ?? JSON.stringify(err);
};
for (const [step, expected, signature] of earlier) {
  let tx = null;
  for (let i = 0; i < 6 && !tx; i++) {
    tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null);
    if (!tx) await new Promise((r) => setTimeout(r, 2500));
  }
  if (!tx) stop(`could not read ${step}`);
  const actual = errorName(tx!.meta?.err);
  // The Anchor client lower-cases the first letter of error names.
  if (actual.toLowerCase() !== expected.toLowerCase()) stop(`${step} was ${actual}, expected ${expected}`);
  rows.push({ step, expected, actual, passed: true, signature, explorerUrl: explorerTx(signature) });
  console.log(`VERIFIED  ${step}: ${actual}`);
}

// Pre-flight: the state must be exactly what B1-B7 left behind.
const v = await accounts.vault.fetchNullable(vault);
if (!v) stop("proof vault not found");
if (!v.owner.equals(owner.publicKey) || !v.authorizedAgent.equals(agent.publicKey)) stop("vault owner or agent differs");
if (!v.approvedRecipient.equals(recipient)) stop("vault recipient is not PROOF_RECIPIENT");
if (v.maxAmountLamports.toNumber() !== 50_000_000) stop("vault limit is not 0.05 SOL");
if (await accounts.paymentProposal.fetchNullable(proposal)) stop("a proposal already exists");
const vaultLamports = await connection.getBalance(vault, "confirmed");
if (vaultLamports !== EXPECTED_VAULT_LAMPORTS) stop(`vault holds ${vaultLamports}, expected ${EXPECTED_VAULT_LAMPORTS}`);
const ownerLamports = await connection.getBalance(owner.publicKey, "confirmed");
const agentLamports = await connection.getBalance(agent.publicKey, "confirmed");
const recipientStart = await connection.getBalance(recipient, "confirmed");
const spent = START_BALANCE - ownerLamports;
// B10 and B11 are the only deployer-paid steps left: two 5,000-lamport fees.
if (spent + 10_000 > LIMIT) stop(`budget: ${spent} spent`);
if (agentLamports < 1_473_200 + 10_000) stop("agent cannot cover proposal rent and fees");
console.log(JSON.stringify({ deployerLamports: ownerLamports, cumulativeSpent: spent, agentLamports, vaultLamports, recipientStart }));
if (process.argv.includes("--check")) {
  console.log("CHECK ONLY: all pre-flight checks passed, no transactions sent");
  process.exit(0);
}

function record(step: string, expected: string, outcome: ProposalOutcome) {
  const actual = outcome.error ? outcome.error.name : "success";
  const passed = actual === expected;
  rows.push({ step, expected, actual, passed, signature: outcome.signature, explorerUrl: outcome.explorerUrl });
  console.log(`${passed ? "PASS" : "FAIL"}  ${step}: ${actual}\n      ${outcome.explorerUrl}`);
  if (!passed) stop(`unexpected result for "${step}"`);
}
const execute = async (signer: typeof owner, nonce: number) =>
  chain.sendAndReport(
    (await program.methods
      .approveAndExecutePayment(new BN(nonce))
      .accountsPartial({ owner: signer.publicKey, vault, proposal, recipient })
      .transaction()) as Transaction,
    signer
  );

record(
  "B8 Authorized agent proposes 0.01 SOL",
  "success",
  await chain.propose({ vault, lamports: BigInt(PAYMENT), recipient, intentHash: createHash("sha256").update("valid").digest() })
);
const pending = await accounts.paymentProposal.fetch(proposal);
const nonce = pending.nonce.toNumber();
if (!("pending" in pending.status)) stop("proposal is not pending");
if ((await connection.getBalance(recipient, "confirmed")) !== recipientStart) stop("funds moved before owner approval");
if ((await connection.getBalance(vault, "confirmed")) !== EXPECTED_VAULT_LAMPORTS) stop("vault changed before owner approval");
console.log("PASS  No funds moved after the proposal alone");

record("B9 Agent tries to execute its own proposal", "UnauthorizedOwner", await execute(agent, nonce));
record("B10 Owner approves and executes", "success", await execute(owner, nonce));

const recipientEnd = await connection.getBalance(recipient, "confirmed");
const vaultEnd = await connection.getBalance(vault, "confirmed");
if (recipientEnd - recipientStart !== PAYMENT) stop(`recipient received ${recipientEnd - recipientStart}, expected ${PAYMENT}`);
if (EXPECTED_VAULT_LAMPORTS - vaultEnd !== PAYMENT) stop(`vault paid ${EXPECTED_VAULT_LAMPORTS - vaultEnd}, expected ${PAYMENT}`);
console.log("PASS  Recipient received exactly 0.01 SOL from the vault");

record("B11 Replay: execute the same proposal again", "ProposalNotPending", await execute(owner, nonce));
if ((await connection.getBalance(recipient, "confirmed")) !== recipientEnd) stop("replay moved funds");

const finalOwner = await connection.getBalance(owner.publicKey, "confirmed");
const proof = {
  network: "devnet",
  programId: program.programId.toBase58(),
  deploySignature: "5cmrscNwBJt1bYuEUmLj1QVEds15nZyX6pcHx4FRPvg14xz4BSsuvkvrkzRGVHTsydERuf3feMkPcCiBmbUaJZLU",
  binarySha256: "ba3170f3ffe018f690fa092a3fea6bb08717ce26fedddc3015703ff2ae81a312",
  vault: vault.toBase58(),
  recipient: recipient.toBase58(),
  completedAt: new Date().toISOString(),
  note: "B1-B7 ran on the first pass and were verified from their on-chain records. B8-B11 ran in this pass.",
  balances: {
    recipientBefore: recipientStart / LAMPORTS_PER_SOL,
    recipientAfter: recipientEnd / LAMPORTS_PER_SOL,
    vaultBefore: EXPECTED_VAULT_LAMPORTS / LAMPORTS_PER_SOL,
    vaultAfter: vaultEnd / LAMPORTS_PER_SOL,
    deployerAfter: finalOwner / LAMPORTS_PER_SOL,
    deployerCumulativeNetSpend: (START_BALANCE - finalOwner) / LAMPORTS_PER_SOL,
  },
  rows,
};
writeFileSync(new URL("../../docs/devnet-proof.json", import.meta.url), JSON.stringify(proof, null, 2));
console.log(`\nAll ${rows.length} proof steps verified. Saved docs/devnet-proof.json`);
console.log(JSON.stringify(proof.balances));
