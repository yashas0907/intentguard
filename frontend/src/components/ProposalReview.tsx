import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { BN } from "@anchor-lang/core";
import { Check, CircleX, Inbox, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchIntentDetails, IntentDetails } from "../lib/api";
import { explorerAddress, formatSol, programErrorByCode } from "../lib/chain";
import { useSendTransaction } from "../lib/useSendTransaction";
import type { VaultState } from "../lib/useVaultState";
import { Address, Button, EnforcementTag, Panel, TxNotice } from "./ui";

type Simulation =
  | { state: "running" }
  | { state: "ok"; vaultChange: bigint; recipientChange: bigint; units: number | null }
  | { state: "failed"; message: string }
  | { state: "unavailable"; message: string };

const toHex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

export function ProposalReview({ state }: { state: VaultState }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { proposal, vault, vaultAddress, proposalAddress, program } = state;
  const isPending = Boolean(proposal && "pending" in proposal.status);
  const nonce = proposal?.nonce.toString();
  const approve = useSendTransaction(state.refresh);
  const reject = useSendTransaction(state.refresh);
  const [simulation, setSimulation] = useState<Simulation>({ state: "running" });
  const [details, setDetails] = useState<IntentDetails | null>(null);

  const buildApprove = useCallback(() => {
    return program.methods
      .approveAndExecutePayment(new BN(nonce!))
      .accountsPartial({
        owner: publicKey!,
        vault: vaultAddress!,
        proposal: proposalAddress!,
        recipient: proposal!.recipient,
      })
      .transaction();
  }, [program, nonce, publicKey, vaultAddress, proposalAddress, proposal]);

  const simulate = useCallback(async () => {
    if (!isPending || !publicKey || !proposal || !vaultAddress) return;
    setSimulation({ state: "running" });
    try {
      const tx = await buildApprove();
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const [vaultBefore, recipientBefore] = await Promise.all([
        connection.getBalance(vaultAddress),
        connection.getBalance(proposal.recipient),
      ]);
      const { value } = await connection.simulateTransaction(
        new VersionedTransaction(tx.compileMessage()),
        {
          sigVerify: false,
          replaceRecentBlockhash: true,
          accounts: {
            encoding: "base64",
            addresses: [vaultAddress.toBase58(), proposal.recipient.toBase58()],
          },
        }
      );
      if (value.err) {
        const custom = (value.err as { InstructionError?: [number, { Custom?: number }] }).InstructionError?.[1]?.Custom;
        const known = custom === undefined ? undefined : programErrorByCode(custom);
        const text = JSON.stringify(value.err);
        setSimulation({
          state: "failed",
          message: known
            ? `${known.msg} (${known.name})`
            : /rent/i.test(text)
              ? "This amount would leave the recipient below Solana's minimum account balance."
              : text,
        });
        return;
      }
      setSimulation({
        state: "ok",
        vaultChange: BigInt(value.accounts?.[0]?.lamports ?? vaultBefore) - BigInt(vaultBefore),
        recipientChange: BigInt(value.accounts?.[1]?.lamports ?? recipientBefore) - BigInt(recipientBefore),
        units: value.unitsConsumed ?? null,
      });
    } catch (error) {
      console.warn("Simulation failed:", error);
      setSimulation({ state: "unavailable", message: "Couldn't run the simulation. Try again." });
    }
  }, [buildApprove, connection, isPending, proposal, publicKey, vaultAddress]);

  useEffect(() => {
    if (isPending) void simulate();
    // Re-simulate when the proposal or the policy it depends on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, nonce, vault?.maxAmountLamports.toString(), vault?.approvedRecipient.toBase58()]);

  useEffect(() => {
    setDetails(null);
    if (isPending && nonce && vaultAddress) {
      void fetchIntentDetails(vaultAddress.toBase58(), nonce).then(setDetails);
    }
  }, [isPending, nonce, vaultAddress]);

  if (!isPending || !proposal || !vault) {
    return (
      <Panel title="Approvals">
        <div className="flex items-center gap-3 py-2 text-sm text-muted">
          <Inbox size={18} className="text-faint" />
          <span>Nothing is waiting for your approval.</span>
        </div>
        <TxNotice result={approve.result} />
        <TxNotice result={reject.result} />
      </Panel>
    );
  }

  const withinLimit = proposal.amount.lte(vault.maxAmountLamports);
  const recipientApproved = proposal.recipient.equals(vault.approvedRecipient);
  const hash = toHex(Array.from(proposal.intentHash));
  const hashMatches = details ? details.intentHash === hash : null;
  const busy = Boolean(approve.pending || reject.pending);

  return (
    <Panel
      title="Review payment"
      aside={
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
          <span className="pulse-ring h-2 w-2 rounded-full bg-warn" /> Waiting for you
        </span>
      }
      className="border-warn/30"
    >
      <p className="text-4xl font-semibold tracking-tight tabular-nums">
        {formatSol(proposal.amount)}
        <span className="ml-1.5 text-lg font-medium text-muted">SOL</span>
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        to <Address value={proposal.recipient.toBase58()} href={explorerAddress(proposal.recipient.toBase58())} size={6} />
      </div>

      <div className="mt-4 rounded-lg bg-ink p-3 text-sm">
        <p className="text-xs font-medium text-faint">Original request</p>
        {details ? (
          <>
            <p className="mt-1 break-words">“{details.prompt}”</p>
            <p className="mt-1 text-xs text-muted">
              {details.model}, {Math.round(details.parsedIntent.confidence * 100)}% confidence
              {details.parsedIntent.memo && `: ${details.parsedIntent.memo}`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-muted">Not available from this backend session. Rely on the on-chain details here.</p>
        )}
        <p className="mt-2 break-all font-mono text-[11px] text-faint">
          On-chain intent hash {hash.slice(0, 24)}…
          {hashMatches === true && <span className="text-guard"> matches this request</span>}
          {hashMatches === false && <span className="text-danger"> does NOT match this request</span>}
        </p>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted">Policy</p>
          <EnforcementTag where="on-chain" />
        </div>
        <ul className="space-y-1.5 text-sm">
          <CheckRow ok={withinLimit} label={`Within the ${formatSol(vault.maxAmountLamports)} SOL limit`} />
          <CheckRow ok={recipientApproved} label="Recipient is the approved address" />
          <CheckRow ok={proposal.agent.equals(vault.authorizedAgent)} label="Proposed by the authorized agent" />
        </ul>
        <p className="mt-1.5 text-xs text-faint">
          Shown here for review. The program checks these again when you approve.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-line p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted">Simulation on Devnet (no funds move)</p>
          <button
            type="button"
            onClick={simulate}
            aria-label="Run simulation again"
            className="text-faint transition hover:text-fg"
          >
            <RefreshCw size={13} className={simulation.state === "running" ? "animate-spin" : ""} />
          </button>
        </div>
        {simulation.state === "running" && <p className="mt-1 text-muted">Simulating…</p>}
        {simulation.state === "ok" && (
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 font-mono text-[13px]">
            <dt className="font-sans text-muted">Vault</dt>
            <dd className="text-right">−{formatSol(-simulation.vaultChange)} SOL</dd>
            <dt className="font-sans text-muted">Recipient</dt>
            <dd className="text-right text-guard">+{formatSol(simulation.recipientChange)} SOL</dd>
          </dl>
        )}
        {simulation.state === "failed" && <p className="mt-1 text-danger">Would fail: {simulation.message}</p>}
        {simulation.state === "unavailable" && <p className="mt-1 text-warn">{simulation.message}</p>}
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="danger"
          busy={Boolean(reject.pending)}
          disabled={busy}
          onClick={() =>
            void reject.send("Reject", () =>
              program.methods
                .rejectPayment()
                .accountsPartial({ owner: publicKey!, vault: vaultAddress!, proposal: proposalAddress! })
                .transaction()
            )
          }
        >
          Reject
        </Button>
        <Button
          busy={Boolean(approve.pending)}
          disabled={busy || simulation.state !== "ok"}
          onClick={() => void approve.send("Payment", buildApprove)}
        >
          {approve.pending ? "Confirm in Phantom…" : "Approve & execute"}
        </Button>
      </div>
      <TxNotice result={approve.result} />
      <TxNotice result={reject.result} />
    </Panel>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <Check size={15} className="shrink-0 text-guard" /> : <CircleX size={15} className="shrink-0 text-danger" />}
      <span className={ok ? "" : "text-danger"}>{label}</span>
    </li>
  );
}
