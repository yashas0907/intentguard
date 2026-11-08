import { BorshInstructionCoder } from "@anchor-lang/core";
import { useConnection } from "@solana/wallet-adapter-react";
import { ConfirmedSignatureInfo, PublicKey } from "@solana/web3.js";
import { CheckCircle2, ExternalLink, ShieldX } from "lucide-react";
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
    <Panel title="Devnet activity" aside={<span className="text-xs text-faint">Live from Solana</span>}>
      {failed && !rows && <p className="text-sm text-warn">Couldn't load activity from Devnet.</p>}
      {!failed && !rows && <p className="text-sm text-muted">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-muted">No transactions yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="-my-1 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.signature}>
              <a
                href={explorerTx(row.signature)}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2.5 py-2.5"
              >
                {row.failed ? (
                  <ShieldX size={16} className="mt-0.5 shrink-0 text-danger" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-guard" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-guard">
                    {row.failed ? "Blocked on-chain" : (row.label ?? "Transaction")}
                  </span>
                  {row.failed && (
                    <span className="block truncate font-mono text-xs text-danger">
                      {row.errorName ?? "Transaction failed"}
                    </span>
                  )}
                  <span className="block font-mono text-xs text-faint">
                    {shorten(row.signature, 6)}
                    {row.time && ` · ${new Date(row.time * 1000).toLocaleTimeString()}`}
                  </span>
                </span>
                <ExternalLink size={13} className="mt-1 shrink-0 text-faint group-hover:text-guard" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
