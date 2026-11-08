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
    <Panel title="Create your vault" aside={<EnforcementTag where="on-chain" />} className="mx-auto max-w-2xl">
      <p className="mb-5 text-sm leading-relaxed text-muted">
        These rules are stored in your vault on Solana. Only your wallet can change them, and the
        program checks them on every payment.
      </p>
      <p className="mb-5 rounded-lg bg-ink p-3 text-xs text-muted">
        Connected wallet
        <span className="mt-1 block break-all font-mono text-[13px] text-fg">{publicKey?.toBase58()}</span>
      </p>
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
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-xs text-faint">
            {state.walletBalance !== null && `Wallet: ${formatSol(state.walletBalance)} SOL on Devnet`}
          </span>
          <Button type="submit" disabled={Boolean(problem)} busy={Boolean(pending)}>
            {pending ? "Confirm in Phantom…" : "Create vault"}
          </Button>
        </div>
      </form>
      <TxNotice result={result} />
    </Panel>
  );
}
