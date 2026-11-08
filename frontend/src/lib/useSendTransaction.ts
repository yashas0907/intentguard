import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useCallback, useState } from "react";
import { describeError, explorerTx } from "./chain";

export type TxResult =
  | { kind: "success"; label: string; signature: string; url: string }
  | { kind: "failed"; label: string; message: string; signature?: string; url?: string };

/** Opens Phantom for approval, then reports what actually happened on Devnet. */
export function useSendTransaction(onSettled: () => Promise<void> | void) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);

  const send = useCallback(
    async (label: string, build: () => Promise<Transaction>): Promise<boolean> => {
      if (!publicKey) return false;
      setPending(label);
      setResult(null);
      let signature: string | undefined;
      try {
        const tx = await build();
        const latest = await connection.getLatestBlockhash("confirmed");
        tx.feePayer = publicKey;
        tx.recentBlockhash = latest.blockhash;

        signature = await sendTransaction(tx, connection);
        let onChainError: unknown = null;
        try {
          const { value } = await connection.confirmTransaction(
            { signature, ...latest },
            "confirmed"
          );
          onChainError = value.err;
        } catch (error) {
          // web3.js can reject with the transaction's own on-chain error object.
          if (typeof error !== "object" || error === null || error instanceof Error) throw error;
          onChainError = error;
        }
        if (onChainError) throw new Error(JSON.stringify(onChainError));

        setResult({ kind: "success", label, signature, url: explorerTx(signature) });
        return true;
      } catch (error) {
        console.warn(`${label} failed:`, error);
        setResult({
          kind: "failed",
          label,
          message: describeError(error),
          signature,
          url: signature ? explorerTx(signature) : undefined,
        });
        return false;
      } finally {
        setPending(null);
        await onSettled();
      }
    },
    [connection, publicKey, sendTransaction, onSettled]
  );

  return { send, pending, result };
}
