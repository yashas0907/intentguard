import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const U64_MAX = 18_446_744_073_709_551_615n;
export const MIN_CONFIDENCE = 0.8;
export const MAX_PROMPT_LENGTH = 500;

/** The exact shape the AI must return. Anything else is rejected. */
export const aiIntentSchema = z.strictObject({
  is_payment_request: z.boolean(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  recipient_type: z.enum(["approved_recipient", "explicit_address", "unknown"]),
  recipient_address: z.string().nullable(),
  memo: z.string().max(200),
  confidence: z.number().min(0).max(1),
});
export type AiIntent = z.infer<typeof aiIntentSchema>;

export type ValidatedIntent = {
  lamports: bigint;
  amountSol: string;
  recipient: PublicKey;
  memo: string;
  confidence: number;
};

export type IntentResult =
  | { ok: true; intent: ValidatedIntent }
  | { ok: false; code: string; message: string };

const invalid = (code: string, message: string): IntentResult => ({ ok: false, code, message });

/** Exact decimal conversion: floats can't represent SOL amounts safely. */
export function solToLamports(amount: string): bigint | null {
  const match = /^(\d{1,20})(?:\.(\d{1,9}))?$/.exec(amount.trim());
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(9, "0"));
  const lamports = whole * LAMPORTS_PER_SOL + fraction;
  return lamports > U64_MAX ? null : lamports;
}

function parseAddress(address: string): PublicKey | null {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
}

/**
 * Checks that the AI output is well formed and unambiguous. This deliberately does
 * NOT check the spending limit or recipient allowlist: those violations go to the
 * Solana program, which is the only real enforcement.
 */
export function validateIntent(
  raw: unknown,
  prompt: string,
  approvedRecipient: PublicKey
): IntentResult {
  const parsed = aiIntentSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid("MALFORMED_AI_OUTPUT", "The AI response did not match the required format.");
  }
  const ai = parsed.data;

  if (!ai.is_payment_request) {
    return invalid("NOT_A_PAYMENT", "This doesn't look like a payment request.");
  }
  if (ai.confidence < MIN_CONFIDENCE) {
    return invalid("AMBIGUOUS_REQUEST", "The request is too ambiguous. State an amount and recipient.");
  }
  if (ai.currency?.toUpperCase() !== "SOL") {
    return invalid("UNSUPPORTED_CURRENCY", "Only native SOL payments are supported.");
  }

  const lamports = ai.amount === null ? null : solToLamports(ai.amount);
  if (lamports === null || lamports === 0n) {
    return invalid("INVALID_AMOUNT", "The request needs a clear SOL amount greater than zero.");
  }

  let recipient: PublicKey | null = null;
  if (ai.recipient_type === "approved_recipient") {
    // Comes from the vault's on-chain policy, never from the AI.
    recipient = approvedRecipient;
  } else if (ai.recipient_type === "explicit_address") {
    // The address must really be in the prompt, so the AI can't invent or alter one.
    if (ai.recipient_address && prompt.includes(ai.recipient_address)) {
      recipient = parseAddress(ai.recipient_address);
    }
    if (!recipient) {
      return invalid("INVALID_RECIPIENT", "The recipient address is not valid.");
    }
  } else {
    return invalid("UNKNOWN_RECIPIENT", "The request doesn't identify a recipient clearly.");
  }

  return {
    ok: true,
    intent: { lamports, amountSol: ai.amount!.trim(), recipient, memo: ai.memo, confidence: ai.confidence },
  };
}

export function computeIntentHash(input: {
  prompt: string;
  lamports: bigint;
  recipient: string;
  memo: string;
  timestamp: number;
}): Buffer {
  const payload = JSON.stringify({ ...input, lamports: input.lamports.toString() });
  return createHash("sha256").update(payload).digest();
}
