import { readFileSync } from "node:fs";
import anchor, { type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

// This package is CommonJS: at runtime Node only exposes its exports on the default import.
const { AnchorProvider, BN, Program, Wallet } = anchor;
type Program = InstanceType<typeof anchor.Program>;
type BN = InstanceType<typeof anchor.BN>;

// The Devnet genesis hash can't be spoofed by a misleading RPC URL or hostname.
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

const idl = JSON.parse(
  readFileSync(new URL("./idl/intentguard.json", import.meta.url), "utf8")
) as Idl & { errors?: { code: number; name: string; msg: string }[] };

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

export type ProposalOutcome = {
  signature: string;
  explorerUrl: string;
  error: { code: number; name: string; message: string } | null;
};

/**
 * Retries dropped connections to the RPC. Safe for sends too: a signed transaction
 * has one signature, so the network won't process a resend twice.
 */
const fetchWithRetry: typeof fetch = async (input, init) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
};

/** A transaction error reported by the chain, as opposed to a JavaScript Error. */
export const isOnChainError = (error: unknown) =>
  typeof error === "object" && error !== null && !(error instanceof Error);

export const loadKeypair = (path: string) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));

export class AgentChain {
  readonly connection: Connection;
  readonly agent: Keypair;
  readonly program: Program;

  constructor(rpcUrl: string, agent: Keypair) {
    this.connection = new Connection(rpcUrl, { commitment: "confirmed", fetch: fetchWithRetry });
    this.agent = agent;
    const provider = new AnchorProvider(this.connection, new Wallet(this.agent), {
      commitment: "confirmed",
    });
    this.program = new Program(idl, provider);
  }

  async assertDevnet() {
    let hash: string | undefined;
    for (let attempt = 1; attempt <= 5 && !hash; attempt++) {
      try {
        hash = await this.connection.getGenesisHash();
      } catch {
        console.warn(`Can't reach the RPC yet (attempt ${attempt} of 5).`);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    if (!hash) throw new Error("Refusing to start: couldn't confirm the network is Devnet.");
    if (hash !== DEVNET_GENESIS_HASH) {
      throw new Error(`Refusing to start: RPC is not Devnet (genesis ${hash}).`);
    }
  }

  /** Returns null when the address is empty or is not an IntentGuard vault. */
  async fetchVault(vault: PublicKey) {
    const info = await this.connection.getAccountInfo(vault, "confirmed");
    if (!info || !info.owner.equals(this.program.programId)) return null;
    try {
      return (this.program.coder.accounts as any).decode("vault", info.data) as {
        owner: PublicKey;
        authorizedAgent: PublicKey;
        approvedRecipient: PublicKey;
        maxAmountLamports: BN;
      };
    } catch {
      return null; // A program-owned account of another type, such as a proposal.
    }
  }

  /** The current proposal, or null. Reads are retried; a persistent failure throws. */
  async fetchProposal(vault: PublicKey) {
    const address = this.proposalAddress(vault);
    for (let attempt = 1; ; attempt++) {
      try {
        return ((await (this.program.account as any).paymentProposal.fetchNullable(address, "confirmed")) ?? null) as {
          status: Record<string, unknown>;
          nonce: BN;
        } | null;
      } catch (error) {
        if (attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  proposalAddress(vault: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vault.toBuffer()],
      this.program.programId
    )[0];
  }

  /**
   * Signs and sends propose_payment, the only instruction the agent can sign.
   * skipPreflight sends it even when it will fail, so the program itself rejects
   * policy violations and the failure is a real, inspectable Devnet transaction.
   */
  async propose(args: {
    vault: PublicKey;
    lamports: bigint;
    recipient: PublicKey;
    intentHash: Buffer;
  }): Promise<ProposalOutcome> {
    const proposal = this.proposalAddress(args.vault);
    const tx = await this.program.methods
      .proposePayment(new BN(args.lamports.toString()), args.recipient, Array.from(args.intentHash))
      .accountsPartial({ agent: this.agent.publicKey, vault: args.vault, proposal })
      .transaction();

    return this.sendAndReport(tx, this.agent);
  }

  /** Sends without preflight and reports the real on-chain result. */
  async sendAndReport(tx: Transaction, signer: Keypair): Promise<ProposalOutcome> {
    const latest = await this.connection.getLatestBlockhash("confirmed");
    tx.feePayer = signer.publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.sign(signer);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
    });
    let err: unknown = null;
    try {
      const { value } = await this.connection.confirmTransaction(
        { signature, ...latest },
        "confirmed"
      );
      err = value.err;
    } catch (error) {
      // web3.js sometimes rejects with the transaction's own on-chain error instead of
      // returning it. That is a confirmed result, not a network failure.
      if (!isOnChainError(error)) throw error;
      err = error;
    }

    return {
      signature,
      explorerUrl: explorerTx(signature),
      error: err ? this.describeError(err) : null,
    };
  }

  private describeError(err: unknown): NonNullable<ProposalOutcome["error"]> {
    const custom = (err as { InstructionError?: [number, { Custom?: number }] }).InstructionError?.[1]
      ?.Custom;
    const known = idl.errors?.find((e) => e.code === custom);
    if (known) return { code: known.code, name: known.name, message: known.msg ?? known.name };
    return { code: custom ?? -1, name: "TransactionFailed", message: JSON.stringify(err) };
  }
}
