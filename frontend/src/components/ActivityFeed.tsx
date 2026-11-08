import { BorshInstructionCoder } from "@anchor-lang/core";
import { useConnection } from "@solana/wallet-adapter-react";
import { ConfirmedSignatureInfo, PublicKey } from "@solana/web3.js";
import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import idl from "../idl/intentguard.json";
import { explorerTx, programErrorByCode, PROGRAM_ID, shorten } from "../lib/chain";
import { Panel } from "./ui";

const LABELS: Record<string, string> = {
  initializeVault: "Vault created",
  initialize_vault: "Vault created",
  depositSol: "Deposit",
  deposit_sol: "Deposit",
  updatePolicy: "Policy updated",
  update_policy: "Policy updated",
  proposePayment: "Agent proposal",
  propose_payment: "Agent proposal",
  approveAndExecutePayment: "Owner approved payment",
  approve_and_execute_payment: "Owner approved payment",
  rejectPayment: "Owner rejected",
  reject_payment: "Owner rejected",
};

type Row = { signature: string; failed: boolean; errorName?: string; time: number | null; label?: string };

const FEED_SIZE = 12;

/** Real Devnet history for this vault, including transactions the program rejected. */
export function ActivityFeed({ vault, refreshKey }: { vault: PublicKey; refreshKey: string }) {
  const { connection } = useConnection();
  const coder = useMemo(() => new BorshInstructionCoder(idl as never), []);
  const labels = useRef(new Map<string, string>());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const labelFor = async (signature: string) => {
      const cached = labels.current.get(signature);
      if (cached) return cached;
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) return undefined;
      const keys = tx.transaction.message.getAccountKeys();
      for (const ix of tx.transaction.message.compiledInstructions) {
        if (!keys.get(ix.programIdIndex)?.equals(PROGRAM_ID)) continue;
        const decoded = coder.decode(Buffer.from(ix.data));
        const label = decoded ? LABELS[decoded.name] : undefined;
        if (label) {
          labels.current.set(signature, label);
          return label;
        }
      }
      return undefined;
    };

    const toRow = (info: ConfirmedSignatureInfo): Row => {
      const custom = (info.err as { InstructionError?: [number, { Custom?: number }] } | null)?.InstructionError?.[1]?.Custom;
      return {
        signature: info.signature,
        failed: Boolean(info.err),
        errorName: custom === undefined ? undefined : programErrorByCode(custom)?.name,
        time: info.blockTime ?? null,
        label: labels.current.get(info.signature),
      };
    };

    const load = async () => {
      try {
        const infos = await connection.getSignaturesForAddress(vault, { limit: FEED_SIZE }, "confirmed");
        if (!active) return;
        setRows(infos.map(toRow));
        setFailed(false);
        // Sequential on purpose: the public Devnet RPC rate-limits bursts.
        for (const info of infos) {
          if (labels.current.has(info.signature)) continue;
          const label = await labelFor(info.signature).catch(() => undefined);
          if (!active) return;
          if (label) setRows(infos.map(toRow));
        }
      } catch (error) {
        console.warn("Activity read failed:", error);
        if (active) setFailed(true);
      }
    };

    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 12_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // refreshKey changes whenever the vault's balance or proposal changes, so new
    // transactions appear right away instead of on the next timer tick.
  }, [connection, vault, coder, refreshKey]);

  return (
    <Panel
      title="Devnet activity"
      eyebrow="On-chain history"
      aside={
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] text-sys" title="Live from Solana Devnet">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-sys" aria-hidden /> Live
        </span>
      }
      bodyClassName="px-5 py-4"
    >
      {failed && !rows && <p className="text-sm text-warn">Couldn't load activity from Devnet.</p>}
      {!failed && !rows && (
        <div className="space-y-3" role="status" aria-label="Loading activity">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse gap-3">
              <span className="h-5 w-5 rounded-full bg-raised" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-2/3 rounded bg-raised" />
                <span className="block h-2.5 w-1/2 rounded bg-raised/70" />
              </span>
            </div>
          ))}
        </div>
      )}
      {rows?.length === 0 && <p className="text-sm text-muted">No transactions yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="relative">
          <span className="absolute bottom-4 left-[9.5px] top-4 w-px bg-line" aria-hidden />
          {rows.map((row) => (
            <li key={row.signature}>
              <a
                href={explorerTx(row.signature)}
                target="_blank"
                rel="noreferrer"
                className="group relative -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-raised/60"
              >
                <span
                  className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    row.failed ? "border-danger/50 bg-danger-dim text-danger" : "border-guard/40 bg-guard-dim text-guard"
                  }`}
                  aria-hidden
                >
                  {row.failed ? <X size={11} strokeWidth={2.5} /> : <Check size={11} strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${row.failed ? "" : ""} group-hover:text-guard`}>
                    {row.failed ? "Blocked on-chain" : (row.label ?? "Transaction")}
                  </span>
                  {row.failed && (
                    <span className="block truncate font-mono text-xs text-danger">
                      {row.errorName ?? "Transaction failed"}
                    </span>
                  )}
                  <span className="mt-0.5 block font-mono text-[11px] text-faint">
                    {shorten(row.signature, 6)}
                    {row.time && ` · ${new Date(row.time * 1000).toLocaleTimeString()}`}
                  </span>
                </span>
                <ExternalLink size={13} className="mt-1 shrink-0 text-faint transition-colors group-hover:text-guard" aria-hidden />
                <span className="sr-only">Open on Solana Explorer</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
