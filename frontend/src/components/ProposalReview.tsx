import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { BN } from "@anchor-lang/core";
import { ArrowRight, Check, CircleX, Inbox, Info, Lock, RefreshCw } from "lucide-react";
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
      <Panel key="empty" title="Authorization requests" eyebrow="Owner approval">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line-strong bg-raised text-faint">
            <Inbox size={18} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">Nothing is waiting for your approval.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              When the agent proposes a payment, it appears here for your signature. Nothing moves until you approve.
            </p>
          </div>
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
      key={`pending-${nonce}`}
      title="Authorization request"
      eyebrow={`Proposal #${nonce} · from the agent`}
      aside={
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-warn/40 bg-warn-dim px-2 py-1 font-mono text-[11px] font-medium text-warn">
          <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-warn" aria-hidden /> Awaiting your signature
        </span>
      }
      className="border-warn/35"
      bodyClassName="p-0"
    >
      <p className="flex items-center gap-2 border-b border-line bg-warn-dim/30 px-5 py-2.5 text-xs text-warn">
        <Info size={14} className="shrink-0" aria-hidden />
        This is a proposal, not a payment. No funds have moved.
      </p>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="label-mono text-faint">Amount</p>
          <p className="mt-1.5 flex items-baseline gap-2 font-mono text-[44px] font-medium leading-none tracking-[-0.03em] tabular-nums">
            {formatSol(proposal.amount)}
            <span className="font-sans text-base font-medium tracking-normal text-muted">SOL</span>
          </p>
          <dl className="mt-5 overflow-hidden rounded-lg border border-line text-sm">
            <div className="flex items-center justify-between gap-3 bg-raised/40 px-3 py-2">
              <dt className="label-mono text-faint">From vault</dt>
              <dd className="text-muted">
                <Address value={vaultAddress!.toBase58()} href={explorerAddress(vaultAddress!.toBase58())} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
              <dt className="label-mono flex items-center gap-1.5 text-faint">
                <ArrowRight size={12} aria-hidden /> To
              </dt>
              <dd className="text-fg">
                <Address value={proposal.recipient.toBase58()} href={explorerAddress(proposal.recipient.toBase58())} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-ink p-3.5 text-sm">
          <p className="label-mono text-faint">Original request</p>
          {details ? (
            <>
              <p className="mt-1.5 break-words font-serif text-[19px] italic leading-snug">“{details.prompt}”</p>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                <dt className="text-faint">Parsed by</dt>
                <dd className="font-mono text-sys">{details.model}</dd>
                <dt className="text-faint">Intent</dt>
                <dd className="font-mono">
                  {details.parsedIntent.amountSol} SOL{details.parsedIntent.memo && ` · ${details.parsedIntent.memo}`}
                </dd>
                <dt className="text-faint">Confidence</dt>
                <dd className="font-mono">{Math.round(details.parsedIntent.confidence * 100)}%</dd>
              </dl>
            </>
          ) : (
            <p className="mt-1.5 text-muted">Not available from this backend session. Rely on the on-chain details here.</p>
          )}
          <p className="mt-3 border-t border-line pt-2.5 font-mono text-[11px] text-faint">
            <span className="break-all">Intent hash {hash.slice(0, 20)}…</span>
            {hashMatches === true && <span className="ml-1 text-guard">✓ matches this request</span>}
            {hashMatches === false && <span className="ml-1 text-danger">✕ does NOT match this request</span>}
          </p>
        </div>
      </div>

      <div className="grid border-t border-line md:grid-cols-2">
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="label-mono text-faint">Policy checks</p>
            <EnforcementTag where="on-chain" />
          </div>
          <ul className="space-y-2 text-sm">
            <CheckRow ok={withinLimit} label={`Within the ${formatSol(vault.maxAmountLamports)} SOL limit`} />
            <CheckRow ok={recipientApproved} label="Recipient is the approved address" />
            <CheckRow ok={proposal.agent.equals(vault.authorizedAgent)} label="Proposed by the authorized agent" />
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Shown here for review. The program checks these again when you approve.
          </p>
        </div>

        <div className="border-t border-line px-5 py-4 text-sm md:border-l md:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="label-mono text-faint">
              Simulation on Devnet
              <span className="mt-0.5 block normal-case tracking-normal text-faint/80">No funds move</span>
            </p>
            <button
              type="button"
              onClick={simulate}
              aria-label="Run simulation again"
              className="rounded p-0.5 text-faint transition-colors hover:text-fg"
            >
              <RefreshCw size={13} className={simulation.state === "running" ? "animate-spin" : ""} />
            </button>
          </div>
          {simulation.state === "running" && <p className="mt-3 text-muted">Simulating…</p>}
          {simulation.state === "ok" && (
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2 font-mono text-[14px] tabular-nums">
              <dt className="font-sans text-muted">Vault</dt>
              <dd className="text-right">−{formatSol(-simulation.vaultChange)} SOL</dd>
              <dt className="font-sans text-muted">Recipient</dt>
              <dd className="text-right text-guard">+{formatSol(simulation.recipientChange)} SOL</dd>
            </dl>
          )}
          {simulation.state === "failed" && <p className="mt-3 text-danger">Would fail: {simulation.message}</p>}
          {simulation.state === "unavailable" && <p className="mt-3 text-warn">{simulation.message}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-raised/30 px-5 py-4 md:flex-nowrap">
        <p className="flex min-w-0 basis-full items-start gap-2 text-xs leading-relaxed text-muted md:flex-1 md:basis-auto">
          <Lock size={13} className="mt-0.5 shrink-0 text-faint" aria-hidden />
          Approving opens Phantom. The program re-checks the policy before any SOL moves.
        </p>
        <div className="flex w-full shrink-0 gap-2 md:w-auto">
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
            className="h-11 flex-1 px-6 md:flex-none"
          >
            {approve.pending ? "Confirm in Phantom…" : "Approve & execute"}
          </Button>
        </div>
      </div>
      {(approve.result || reject.result) && (
        <div className="px-5 pb-4">
          <TxNotice result={approve.result} />
          <TxNotice result={reject.result} />
        </div>
      )}
    </Panel>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${ok ? "bg-guard-dim text-guard" : "bg-danger-dim text-danger"}`}
        aria-hidden
      >
        {ok ? <Check size={12} /> : <CircleX size={12} />}
      </span>
      <span className={ok ? "" : "text-danger"}>
        {label}
        <span className="sr-only">{ok ? ": passes" : ": fails"}</span>
      </span>
    </li>
  );
}
