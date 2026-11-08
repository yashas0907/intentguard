import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ArrowDown } from "lucide-react";
import { Evidence } from "./landing/Evidence";
import { HeroCircuit } from "./landing/HeroCircuit";
import { Story } from "./landing/Story";
import { EnforcementTag, NetworkPill } from "./ui";

const RULES: { rule: string; error: string; where: "on-chain" | "off-chain" }[] = [
  { rule: "Only the authorized agent can propose", error: "UnauthorizedAgent", where: "on-chain" },
  { rule: "Only the approved recipient can be paid", error: "UnapprovedRecipient", where: "on-chain" },
  { rule: "No payment above the per-payment limit", error: "AmountExceedsPolicyLimit", where: "on-chain" },
  { rule: "Only the owner can approve, reject or change policy", error: "UnauthorizedOwner", where: "on-chain" },
  { rule: "A proposal can't be executed twice", error: "ProposalNotPending", where: "on-chain" },
  { rule: "A pending proposal can't be swapped during review", error: "PendingProposalExists, StaleProposal", where: "on-chain" },
  { rule: "The vault always stays rent-exempt", error: "InsufficientVaultBalance", where: "on-chain" },
  { rule: "Malformed, ambiguous or non-SOL requests never reach Solana", error: "Rejected by the backend", where: "off-chain" },
];

export function Landing() {
  return (
    <main>
      <section className="relative pb-24 pt-8 lg:pt-10 xl:pb-20 [@media(min-width:1280px)_and_(max-height:820px)]:pt-6">
        <div className="rise relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <NetworkPill />
            <span className="text-sm text-muted">Payment guardrails for AI agents</span>
          </div>
          <h1 className="hero-title mt-6 max-w-[14ch] text-balance font-serif leading-[0.95] tracking-[-0.015em] xl:max-w-none">
            Human control for autonomous money.
          </h1>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12 [@media(min-width:1280px)_and_(max-height:820px)]:mt-4">
            <p className="max-w-[38rem] text-[18px] leading-relaxed text-muted">
              Your AI agent drafts the payment. Only your signature releases it. A Solana program refuses anything
              outside the limits you set, whoever asks.
            </p>
            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="cta-wallet">
                  <WalletMultiButton>Connect Phantom</WalletMultiButton>
                </div>
                <a
                  href="#how"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-line-strong px-5 text-[15px] font-medium text-fg transition-colors hover:border-faint hover:bg-raised"
                >
                  See how it works <ArrowDown size={15} aria-hidden />
                </a>
              </div>
              <p className="mt-2.5 text-xs text-faint lg:text-right">Set Phantom to Devnet first. Devnet SOL has no real value.</p>
            </div>
          </div>
        </div>

        <div className="rise mt-9 [@media(min-width:1280px)_and_(max-height:820px)]:mt-6" style={{ animationDelay: "0.12s" }}>
          <HeroCircuit />
          <p className="mt-3 text-xs text-faint">
            A schematic of the real flow, not live data. Hover or tab through it to see what each part does.
          </p>
        </div>
      </section>

      <Story />
      <Evidence />

      <section id="rules" className="scroll-mt-16 border-t border-line py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="text-balance font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[48px]">
              What the program refuses.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              On-chain rules run inside the IntentGuard program on every proposal and every approval. The off-chain
              check only saves time and fees. It is never the line of defence.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-panel">
                <tr className="border-b border-line">
                  <th scope="col" className="label-sm px-5 py-3 text-faint">Rule</th>
                  <th scope="col" className="label-sm hidden px-5 py-3 text-faint md:table-cell">Program error</th>
                  <th scope="col" className="label-sm hidden px-5 py-3 text-right text-faint sm:table-cell">Where</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {RULES.map(({ rule, error, where }) => (
                  <tr key={rule} className="transition-colors hover:bg-panel/70">
                    <td className="px-5 py-3.5">
                      <span className="font-medium">{rule}</span>
                      <span className="mt-0.5 block font-mono text-xs text-faint md:hidden">{error}</span>
                      <span className="mt-2 block sm:hidden">
                        <EnforcementTag where={where} />
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 font-mono text-[13px] text-muted md:table-cell">{error}</td>
                    <td className="hidden px-5 py-3.5 text-right sm:table-cell">
                      <EnforcementTag where={where} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-28">
        <div className="relative max-w-2xl">
          <h2 className="text-balance font-serif text-[48px] leading-[1] tracking-[-0.015em] sm:text-[68px]">
            Give your agent a budget, not a key.
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            Create a vault on Devnet, name the one agent that may ask and the one address it may pay, and set the
            most it can ever request. The rest is up to you.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <div className="cta-wallet">
              <WalletMultiButton>Connect Phantom</WalletMultiButton>
            </div>
            <a
              href="https://github.com/yashas0907/intentguard"
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-medium text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
            >
              Read the source on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
