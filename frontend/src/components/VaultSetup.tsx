import { BN } from "@anchor-lang/core";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { FormEvent, useEffect, useState } from "react";
import type { AgentStatus } from "../lib/api";
import { formatSol, solToLamports } from "../lib/chain";
import { useSendTransaction } from "../lib/useSendTransaction";
import type { VaultState } from "../lib/useVaultState";
import { Button, EnforcementTag, Field, Panel, TxNotice } from "./ui";

const toKey = (value: string) => {
  try {
    return new PublicKey(value.trim());
  } catch {
    return null;
  }
};

export function VaultSetup({ state, agent }: { state: VaultState; agent: AgentStatus | null }) {
  const { publicKey } = useWallet();
  const [agentKey, setAgentKey] = useState("");
  const [recipient, setRecipient] = useState("");
  const [maxSol, setMaxSol] = useState("0.5");
  const { send, pending, result } = useSendTransaction(state.refresh);

  useEffect(() => {
    if (agent && !agentKey) setAgentKey(agent.agentPublicKey);
  }, [agent, agentKey]);

  const agentPubkey = toKey(agentKey);
  const recipientPubkey = toKey(recipient);
  const maxLamports = solToLamports(maxSol);
  const problem = state.programDeployed !== true
    ? "Vaults can be created once the program is deployed to Devnet."
    : !agentPubkey
    ? "Enter a valid agent address."
    : !recipientPubkey
      ? "Enter a valid recipient address."
      : recipientPubkey.equals(publicKey!)
        ? "Use a recipient other than your own wallet, so the transfer is easy to see."
        : !maxLamports
          ? "Enter a limit greater than zero."
          : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    void send("Create vault", () =>
      state.program.methods
        .initializeVault(agentPubkey!, recipientPubkey!, new BN(maxLamports!.toString()))
        .accountsPartial({ owner: publicKey!, vault: state.vaultAddress! })
        .transaction()
    );
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-12">
      <div className="rise lg:pt-6">
        <p className="label-mono text-guard">Step 1 of 1</p>
        <h1 className="mt-3 font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.015em]">
          Set the rules
          <br />
          <span className="font-serif text-[1.1em] font-normal italic text-muted">before the agent asks.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Your vault is a program-owned account on Solana Devnet. It stores three rules, and the program checks
          them on every proposal and every approval.
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {[
            ["Authorized agent", "The only key that can propose payments. It can never move funds."],
            ["Approved recipient", "The only address the vault can ever pay."],
            ["Limit per payment", "Anything larger is rejected on-chain."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-guard" aria-hidden />
              <span>
                <span className="font-medium">{k}.</span> <span className="text-muted">{v}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-faint">Only your wallet can change these rules later.</p>
      </div>

      <Panel title="Create your vault" eyebrow="New vault" aside={<EnforcementTag where="on-chain" />}>
        <div className="mb-5 rounded-lg border border-line bg-ink px-3 py-2.5">
          <span className="label-mono text-faint">Connected wallet · owner</span>
          <span className="mt-1 block break-all font-mono text-[13px] text-fg">{publicKey?.toBase58()}</span>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Authorized agent"
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value)}
            placeholder="Agent public key"
            hint={
              agent
                ? "Filled in from the running backend. It can propose payments, never move funds."
                : "The agent backend is offline, so this can't be filled in automatically."
            }
          />
          <Field
            label="Approved recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="The one address this vault may pay"
          />
          <Field
            label="Maximum per payment (SOL)"
            value={maxSol}
            inputMode="decimal"
            onChange={(e) => setMaxSol(e.target.value)}
          />
          {(recipient || state.programDeployed === false) && problem && <p className="text-sm text-warn">{problem}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
            <span className="font-mono text-xs text-faint">
              {state.walletBalance !== null && `Wallet: ${formatSol(state.walletBalance)} SOL on Devnet`}
            </span>
            <Button type="submit" disabled={Boolean(problem)} busy={Boolean(pending)}>
              {pending ? "Confirm in Phantom…" : "Create vault"}
            </Button>
          </div>
        </form>
        <TxNotice result={result} />
      </Panel>
    </div>
  );
}
