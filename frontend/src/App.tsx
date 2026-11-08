import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentConsole } from "./components/AgentConsole";
import { Wordmark } from "./components/Emblem";
import { Landing } from "./components/Landing";
import { ProposalReview } from "./components/ProposalReview";
import { VaultCard } from "./components/VaultCard";
import { VaultSetup } from "./components/VaultSetup";
import { Address, NetworkPill } from "./components/ui";
import { AgentStatus, fetchAgentStatus } from "./lib/api";
import { explorerAddress, PROGRAM_ID, shorten } from "./lib/chain";
import { useVaultState } from "./lib/useVaultState";

export default function App() {
  const { publicKey } = useWallet();
  const state = useVaultState();
  const [agent, setAgent] = useState<AgentStatus | null>(null);

  useEffect(() => {
    const load = () => void fetchAgentStatus().then(setAgent);
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  const programMismatch = agent && agent.programId !== PROGRAM_ID.toBase58();
  const pending = Boolean(state.proposal && "pending" in state.proposal.status);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="grid-field pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px]" aria-hidden />

      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" aria-label="IntentGuard home" className="rounded-md">
              <Wordmark />
            </a>
            {publicKey && (
              <span className="hidden items-center gap-3 md:flex">
                <span className="h-5 w-px bg-line-strong" aria-hidden />
                <span className="label-mono text-muted">Console</span>
                {state.vaultAddress && state.vault && (
                  <span className="font-mono text-xs text-faint">vault {shorten(state.vaultAddress.toBase58(), 4)}</span>
                )}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main">
            {!publicKey && (
              <span className="hidden items-center gap-6 pr-2 text-sm text-muted lg:flex">
                <a href="#how" className="transition-colors hover:text-fg">How it works</a>
                <a href="#enforcement" className="transition-colors hover:text-fg">Enforcement</a>
              </span>
            )}
            <span className="hidden sm:inline-flex">
              <NetworkPill />
            </span>
            <WalletMultiButton />
          </nav>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1440px] px-5 pb-16 sm:px-8">
        <div className="space-y-2 pt-5 empty:hidden">
          {state.programDeployed === false && (
            <Banner>The IntentGuard program isn't deployed to Devnet yet, so vaults can't be created.</Banner>
          )}
          {state.rpcError && <Banner>Can't reach Solana Devnet right now. Showing the last data received.</Banner>}
          {programMismatch && <Banner>The backend and dashboard are using different program IDs.</Banner>}
        </div>

        {!publicKey ? (
          <Landing />
        ) : state.loading && !state.vault ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-sm text-muted" role="status">
            <Loader2 size={20} className="animate-spin text-guard" aria-hidden />
            Reading your vault from Solana Devnet…
          </div>
        ) : !state.vault ? (
          <div className="py-10">
            <VaultSetup state={state} agent={agent} />
          </div>
        ) : (
          <div className="pt-6">
            <FlowStrip pending={pending} />
            <main className="mt-5 grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_340px]">
              <VaultCard state={state} />
              <div className="space-y-5">
                <AgentConsole state={state} agent={agent} />
                <ProposalReview state={state} />
              </div>
              <div className="lg:col-span-2 xl:col-span-1">
                <ActivityFeed
                  vault={state.vaultAddress!}
                  refreshKey={`${state.balance}-${state.proposal?.nonce.toString()}-${Object.keys(state.proposal?.status ?? {})[0]}`}
                />
              </div>
            </main>
          </div>
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-faint">
          {publicKey ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="label-mono">Program</span>
              <span className="text-muted">
                <Address value={PROGRAM_ID.toBase58()} href={explorerAddress(PROGRAM_ID.toBase58())} />
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold text-muted">IntentGuard</span>
              <span>Human control for autonomous money.</span>
            </span>
          )}
          <span>Solana Devnet only. These tokens have no real value.</span>
        </footer>
      </div>
    </div>
  );
}

/** Where the current payment stands: the agent proposes, the owner decides, Solana enforces. */
function FlowStrip({ pending }: { pending: boolean }) {
  const steps = [
    { n: "01", title: "Agent proposes", text: "Gemini parses, the agent submits", tone: pending ? "idle" : "on" },
    {
      n: "02",
      title: "You decide",
      text: pending ? "A payment is waiting for you" : "Nothing waiting",
      tone: pending ? "wait" : "idle",
    },
    { n: "03", title: "Solana enforces", text: "Policy checked on-chain every time", tone: "on" },
  ] as const;
  return (
    <ol className="rise grid overflow-hidden rounded-xl border border-line bg-panel sm:grid-cols-3" aria-label="Payment flow">
      {steps.map((step, i) => (
        <li
          key={step.n}
          aria-current={step.tone === "wait" ? "step" : undefined}
          className={`relative flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""} ${
            step.tone === "wait" ? "bg-warn-dim/45" : ""
          }`}
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono text-xs font-medium ${
              step.tone === "wait"
                ? "pulse-ring border-warn/50 bg-warn-dim text-warn"
                : step.tone === "on"
                  ? "border-guard/30 bg-guard-dim text-guard"
                  : "border-line-strong bg-raised text-faint"
            }`}
          >
            {step.n}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-semibold tracking-tight ${step.tone === "wait" ? "text-warn" : ""}`}>
              {step.title}
            </span>
            <span className="block truncate text-xs text-muted">{step.text}</span>
          </span>
          {step.tone === "wait" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-warn" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rise rounded-lg border border-warn/30 bg-warn-dim/50 px-4 py-2.5 text-sm text-warn">
      {children}
    </p>
  );
}
