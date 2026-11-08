import { BN } from "@anchor-lang/core";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
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

  return (
    <div className="space-y-5">
      <Panel>
        <p className="text-xs font-medium text-muted">Spendable balance</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
          {state.spendable === null ? "…" : formatSol(state.spendable)}
          <span className="ml-1.5 text-lg font-medium text-muted">SOL</span>
        </p>
        <p className="mt-1 text-xs text-faint">
          {state.balance !== null &&
            state.spendable !== null &&
            `Plus ${formatSol(state.balance - state.spendable)} SOL held back to keep the vault rent-exempt.`}
        </p>
        <div className="mt-3 text-muted">
          <Address value={vaultAddress.toBase58()} href={explorerAddress(vaultAddress.toBase58())} size={6} />
        </div>

        <form onSubmit={submitDeposit} className="mt-4 flex items-end gap-2">
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
        <TxNotice result={depositTx.result} />
      </Panel>

      <Panel title="Spending policy" aside={<EnforcementTag where="on-chain" />}>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Max per payment</dt>
            <dd className="font-mono text-[13px]">{formatSol(vault.maxAmountLamports)} SOL</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Approved recipient</dt>
            <dd>
              <Address
                value={vault.approvedRecipient.toBase58()}
                href={explorerAddress(vault.approvedRecipient.toBase58())}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Authorized agent</dt>
            <dd>
              <Address
                value={vault.authorizedAgent.toBase58()}
                href={explorerAddress(vault.authorizedAgent.toBase58())}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="whitespace-nowrap text-muted">Payments require</dt>
            <dd className="whitespace-nowrap text-[13px]">Your Phantom signature</dd>
          </div>
        </dl>

        {editing ? (
          <form onSubmit={submitPolicy} className="mt-4 space-y-3 border-t border-line pt-4">
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
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setEditing(true)}>
            Edit policy
          </Button>
        )}
        <TxNotice result={policyTx.result} />
      </Panel>
    </div>
  );
}
