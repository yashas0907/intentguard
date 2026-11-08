import { BN, Program } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "../idl/intentguard.json";
import type { Intentguard } from "../idl/intentguard";

const DEVNET_RPC = "https://api.devnet.solana.com";

// An override can point at a private Devnet RPC or a local validator, nothing else.
const override = import.meta.env.VITE_RPC_URL as string | undefined;
export const RPC_URL =
  override && /devnet|^https?:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(override)
    ? override
    : DEVNET_RPC;
export const LAMPORTS_PER_SOL = 1_000_000_000n;

const idl = idlJson as unknown as Intentguard;
export const PROGRAM_ID = new PublicKey(idl.address);

export const getProgram = (connection: Connection) =>
  new Program<Intentguard>(idl, { connection });
export type IntentguardProgram = ReturnType<typeof getProgram>;

export const vaultPda = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault"), owner.toBuffer()], PROGRAM_ID)[0];

export const proposalPda = (vault: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("proposal"), vault.toBuffer()], PROGRAM_ID)[0];

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export const explorerAddress = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;

export const shorten = (value: string, size = 4) =>
  value.length <= size * 2 + 3 ? value : `${value.slice(0, size)}…${value.slice(-size)}`;

/** Exact decimal SOL to lamports. Returns null for anything that isn't a positive amount. */
export function solToLamports(amount: string): bigint | null {
  const match = /^(\d{1,20})(?:\.(\d{1,9}))?$/.exec(amount.trim());
  if (!match) return null;
  const lamports =
    BigInt(match[1]) * LAMPORTS_PER_SOL + BigInt((match[2] ?? "").padEnd(9, "0"));
  return lamports > 0n ? lamports : null;
}

/** Lamports to a SOL string without floating point rounding. */
export function formatSol(lamports: BN | bigint | number): string {
  const value = BigInt(lamports.toString());
  const whole = value / LAMPORTS_PER_SOL;
  const fraction = (value % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export const programErrorByCode = (code: number) =>
  idl.errors.find((error) => error.code === code);

/** Turns wallet, RPC and program failures into something a person can act on. */
export function describeError(error: unknown): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
  if (/reject/i.test(text) && /user|request/i.test(text)) {
    return "You declined the request in Phantom. Nothing was sent.";
  }
  const hex = /custom program error: 0x([0-9a-f]+)/i.exec(text)?.[1];
  const number = /Error Number: (\d+)/.exec(text)?.[1] ?? /"Custom":(\d+)/.exec(text)?.[1];
  const code = hex ? parseInt(hex, 16) : number ? Number(number) : null;
  const known = code === null ? undefined : programErrorByCode(code);
  if (known) return `${known.msg} (${known.name})`;
  if (/insufficient (funds|lamports)|debit an account/i.test(text)) {
    return "Your wallet doesn't have enough Devnet SOL for this.";
  }
  return text;
}
