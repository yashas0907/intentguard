import { BN } from "@anchor-lang/core";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ArrowDown, Lock } from "lucide-react";
import { FormEvent, useState } from "react";
import { explorerAddress, formatSol, solToLamports } from "../lib/chain";
import { useSendTransaction } from "../lib/useSendTransaction";
import type { VaultState } from "../lib/useVaultState";
import { Address, Button, EnforcementTag, Field, Panel, TxNotice } from "./ui";

const toKey = (value: string) => {
  try {
    return new PublicKey(value.trim());
  } catch {
    return null;
  }
};

export function VaultCard({ state }: { state: VaultState }) {
  const { publicKey } = useWallet();
  const vault = state.vault!;
  const vaultAddress = state.vaultAddress!;
  const [deposit, setDeposit] = useState("");
  const [editing, setEditing] = useState(false);
  const [agent, setAgent] = useState("");
  const [recipient, setRecipient] = useState("");
  const [maxSol, setMaxSol] = useState("");
  const depositTx = useSendTransaction(state.refresh);
  const policyTx = useSendTransaction(state.refresh);

  const depositLamports = solToLamports(deposit);
  const submitDeposit = async (event: FormEvent) => {
    event.preventDefault();
    if (!depositLamports) return;
    const done = await depositTx.send("Deposit", () =>
      state.program.methods
        .depositSol(new BN(depositLamports.toString()))
        .accountsPartial({ owner: publicKey!, vault: vaultAddress })
        .transaction()
    );
    if (done) setDeposit("");
  };

  const newAgent = agent.trim() ? toKey(agent) : null;
  const newRecipient = recipient.trim() ? toKey(recipient) : null;
  const newMax = maxSol.trim() ? solToLamports(maxSol) : null;
  const policyInvalid =
    (agent.trim() && !newAgent) || (recipient.trim() && !newRecipient) || (maxSol.trim() && !newMax);
  const policyEmpty = !newAgent && !newRecipient && !newMax;

  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (policyInvalid || policyEmpty) return;
    const done = await policyTx.send("Update policy", () =>
      state.program.methods
        .updatePolicy(newAgent, newRecipient, newMax ? new BN(newMax.toString()) : null)
        .accountsPartial({ owner: publicKey!, vault: vaultAddress })
        .transaction()
    );
    if (done) {
      setAgent("");
      setRecipient("");
      setMaxSol("");
      setEditing(false);
    }
  };

  const owner = vault.owner.toBase58();
  const isYou = publicKey?.toBase58() === owner;

  return (
    <div className="space-y-5">
      <Panel bodyClassName="p-0">
        <div className="border-b border-line px-5 pb-5 pt-4">
          <p className="label-mono text-faint">Spendable balance</p>
          <p className="mt-2 flex items-baseline gap-2 font-mono text-[44px] font-medium leading-none tracking-[-0.03em] tabular-nums">
            {state.spendable === null ? (
              <span className="inline-block h-9 w-32 animate-pulse rounded-md bg-raised" aria-label="Loading balance" />
            ) : (
              formatSol(state.spendable)
            )}
            <span className="font-sans text-base font-medium tracking-normal text-muted">SOL</span>
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-faint">
            {state.balance !== null &&
              state.spendable !== null &&
              `Plus ${formatSol(state.balance - state.spendable)} SOL held back to keep the vault rent-exempt.`}
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 border-b border-line px-5 py-4 text-sm">
          <dt className="label-mono self-center text-faint">Vault</dt>
          <dd className="justify-self-end text-muted">
            <Address value={vaultAddress.toBase58()} href={explorerAddress(vaultAddress.toBase58())} size={5} />
          </dd>
          <dt className="label-mono self-center text-faint">Owner</dt>
          <dd className="flex items-center justify-end gap-2 text-muted">
            {isYou && <span className="rounded border border-guard/25 bg-guard-dim px-1.5 font-mono text-[10px] text-guard">YOU</span>}
            <Address value={owner} href={explorerAddress(owner)} size={5} />
          </dd>
        </dl>

        <form onSubmit={submitDeposit} className="flex items-end gap-2 px-5 py-4">
          <div className="flex-1">
            <Field
              label="Deposit SOL"
              value={deposit}
              inputMode="decimal"
              placeholder="1.0"
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!depositLamports} busy={Boolean(depositTx.pending)}>
            Deposit
          </Button>
        </form>
        {depositTx.result && (
          <div className="px-5 pb-4">
            <TxNotice result={depositTx.result} />
          </div>
        )}
      </Panel>

      <Panel title="Spending policy" eyebrow="Permissions" aside={<EnforcementTag where="on-chain" />}>
        <ol className="relative" aria-label="Who can do what with this vault">
          <span className="absolute bottom-6 left-[11px] top-6 w-px bg-line-strong" aria-hidden />
          <PolicyNode label="Authorized agent" note="Can propose. Can't move funds.">
            <Address value={vault.authorizedAgent.toBase58()} href={explorerAddress(vault.authorizedAgent.toBase58())} />
          </PolicyNode>
          <PolicyEdge>proposes a payment</PolicyEdge>
          <PolicyNode label="Vault limit" note="Per payment, checked on proposal and approval." accent>
            <span className="font-mono text-[15px] font-medium text-guard">{formatSol(vault.maxAmountLamports)} SOL</span>
          </PolicyNode>
          <PolicyEdge gate>Payments require your Phantom signature</PolicyEdge>
          <PolicyNode label="Approved recipient" note="The only address this vault can pay.">
            <Address value={vault.approvedRecipient.toBase58()} href={explorerAddress(vault.approvedRecipient.toBase58())} />
          </PolicyNode>
        </ol>

        {editing ? (
          <form onSubmit={submitPolicy} className="mt-5 space-y-3 border-t border-line pt-4">
            <p className="text-xs text-faint">Leave a field blank to keep its current value.</p>
            <Field label="New max per payment (SOL)" value={maxSol} inputMode="decimal" onChange={(e) => setMaxSol(e.target.value)} />
            <Field label="New approved recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            <Field label="New authorized agent" value={agent} onChange={(e) => setAgent(e.target.value)} />
            {policyInvalid && <p className="text-sm text-warn">One of these values isn't valid.</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={Boolean(policyInvalid) || policyEmpty} busy={Boolean(policyTx.pending)}>
                Save policy
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setEditing(true)}>
            Edit policy
          </Button>
        )}
        <TxNotice result={policyTx.result} />
      </Panel>
    </div>
  );
}

function PolicyNode({
  label,
  note,
  accent,
  children,
}: {
  label: string;
  note: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3.5">
      <span
        className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
          accent ? "border-guard/50 bg-guard-dim" : "border-line-strong bg-raised"
        }`}
        aria-hidden
      >
        <span className={`h-1.5 w-1.5 rounded-sm ${accent ? "bg-guard" : "bg-muted"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="label-mono text-faint">{label}</span>
          <span className="text-fg">{children}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-faint">{note}</p>
      </div>
    </li>
  );
}

function PolicyEdge({ gate, children }: { gate?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative flex items-center gap-3.5 py-3" aria-hidden={!gate}>
      <span className="relative z-10 grid w-6 shrink-0 place-items-center">
        {gate ? (
          <span className="grid h-5 w-5 place-items-center rounded-full border border-warn/50 bg-warn-dim text-warn">
            <Lock size={10} aria-hidden />
          </span>
        ) : (
          <ArrowDown size={12} className="bg-panel text-faint" aria-hidden />
        )}
      </span>
      <span className={`text-xs ${gate ? "font-medium text-warn" : "text-faint"}`}>{children}</span>
    </li>
  );
}
