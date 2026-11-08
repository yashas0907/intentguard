import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Bot, ChevronRight, Link2, Loader2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentConsole } from "./components/AgentConsole";
import { ProposalReview } from "./components/ProposalReview";
import { VaultCard } from "./components/VaultCard";
import { VaultSetup } from "./components/VaultSetup";
import { Address, Panel } from "./components/ui";
import { AgentStatus, fetchAgentStatus } from "./lib/api";
import { explorerAddress, PROGRAM_ID } from "./lib/chain";
import { useVaultState } from "./lib/useVaultState";

const PILLARS = [
  {
    icon: Bot,
    title: "AI proposes",
    text: "Gemini turns a plain-English request into a structured payment. It never holds a key.",
  },
  {
    icon: UserRoundCheck,
    title: "The owner decides",
    text: "Nothing moves until you review the payment and sign it yourself in Phantom.",
  },
  {
    icon: Link2,
    title: "Solana enforces",
    text: "The program checks the agent, recipient and limit on-chain, even if the backend is compromised.",
  },
];

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

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-6">
      <header className="flex h-[72px] items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-guard-dim text-guard">
            <ShieldCheck size={18} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">IntentGuard</span>
          <span className="ml-1 rounded-md border border-guard/30 px-1.5 py-0.5 text-[11px] font-medium text-guard">
            Devnet
          </span>
        </div>
        <WalletMultiButton />
      </header>

      <div className="mb-5 space-y-2 empty:hidden">
        {state.programDeployed === false && (
          <Banner>The IntentGuard program isn't deployed to Devnet yet, so vaults can't be created.</Banner>
        )}
        {state.rpcError && <Banner>Can't reach Solana Devnet right now. Showing the last data received.</Banner>}
        {programMismatch && <Banner>The backend and dashboard are using different program IDs.</Banner>}
      </div>

      {!publicKey ? (
        <Landing />
      ) : state.loading && !state.vault ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Reading your vault from Devnet…
        </div>
      ) : !state.vault ? (
        <VaultSetup state={state} agent={agent} />
      ) : (
        <>
        <FlowStrip pending={Boolean(state.proposal && "pending" in state.proposal.status)} />
        <main className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
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
        </>
      )}

      <footer className="mt-12 flex flex-wrap items-center gap-x-2 text-xs text-faint">
        <span>Program</span>
        <Address value={PROGRAM_ID.toBase58()} href={explorerAddress(PROGRAM_ID.toBase58())} />
        <span>· Devnet only. These tokens have no real value.</span>
      </footer>
    </div>
  );
}

/** Where the current payment stands in the AI proposes / owner decides / Solana enforces flow. */
function FlowStrip({ pending }: { pending: boolean }) {
  const steps = [
    { icon: Bot, title: "Agent proposes", text: "Gemini parses, the agent submits", active: !pending },
    { icon: UserRoundCheck, title: "You decide", text: pending ? "A payment is waiting for you" : "Nothing waiting", active: pending },
    { icon: Link2, title: "Solana enforces", text: "Policy checked on-chain every time", active: true },
  ];
  return (
    <ol className="rise mb-5 grid gap-2 rounded-xl border border-line bg-panel p-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
      {steps.map(({ icon: Icon, title, text, active }, i) => (
        <li key={title} className="contents">
          {i > 0 && <ChevronRight size={16} className="mx-auto hidden text-faint sm:block" aria-hidden />}
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
              pending && i === 1 ? "bg-warn-dim/50 ring-1 ring-warn/30" : ""
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                pending && i === 1 ? "pulse-ring bg-warn-dim text-warn" : active ? "bg-guard-dim text-guard" : "bg-raised text-faint"
              }`}
            >
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight">{title}</span>
              <span className="block truncate text-xs text-muted">{text}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rise rounded-lg border border-warn/30 bg-warn-dim/40 px-4 py-2.5 text-sm text-warn">
      {children}
    </p>
  );
}

function Landing() {
  return (
    <main className="mx-auto max-w-4xl pt-16 text-center">
      <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
        Human control for autonomous money.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted text-balance">
        Let an AI agent prepare payments without ever giving it access to your funds.
      </p>
      <div className="mt-8 flex justify-center">
        <WalletMultiButton>Connect Phantom</WalletMultiButton>
      </div>
      <p className="mt-3 text-xs text-faint">Set Phantom to Devnet first, in its developer settings.</p>
      <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <Panel key={title}>
            <Icon size={20} className="text-guard" />
            <h2 className="mt-3 font-semibold tracking-tight">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
          </Panel>
        ))}
      </div>
    </main>
  );
}
