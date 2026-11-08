import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { explorerAddress, PROGRAM_ID } from "../lib/chain";
import { Address, EnforcementTag, NetworkPill } from "./ui";

const GUARANTEES = [
  { label: "Agent key", value: "Can only propose" },
  { label: "Release", value: "Your Phantom signature" },
  { label: "Policy", value: "Enforced by the program" },
];

const STEPS = [
  {
    n: "01",
    title: "The agent proposes.",
    text: "Describe a payment in plain English. Gemini turns it into a strict payment intent, and the authorized agent records it on-chain as a proposal. The agent's key can do nothing else.",
    facts: [
      ["Signed by", "Agent key"],
      ["Instruction", "propose_payment"],
      ["Moves funds", "No"],
    ],
  },
  {
    n: "02",
    title: "You decide.",
    text: "Review the original request, the policy checks and a simulation of the exact balance changes. Then approve or reject it in Phantom.",
    facts: [
      ["Signed by", "Your wallet"],
      ["Instruction", "approve_and_execute_payment"],
      ["Moves funds", "Only after re-checks"],
    ],
  },
  {
    n: "03",
    title: "Solana enforces.",
    text: "The program checks the agent, recipient, limit and balance when the agent proposes, and again when you approve. A compromised backend can't change that.",
    facts: [
      ["Runs in", "IntentGuard program"],
      ["Network", "Solana Devnet"],
      ["Bypass", "Not possible off-chain"],
    ],
  },
];

const RULES: { rule: string; error: string; where: "on-chain" | "off-chain" }[] = [
  { rule: "Only the authorized agent can propose", error: "UnauthorizedAgent", where: "on-chain" },
  { rule: "Only the approved recipient can be paid", error: "UnapprovedRecipient", where: "on-chain" },
  { rule: "No payment above the per-payment limit", error: "AmountExceedsPolicyLimit", where: "on-chain" },
  { rule: "Only the owner can approve, reject or change policy", error: "UnauthorizedOwner", where: "on-chain" },
  { rule: "A proposal can't be executed twice", error: "ProposalNotPending", where: "on-chain" },
  { rule: "A pending proposal can't be swapped during review", error: "PendingProposalExists · StaleProposal", where: "on-chain" },
  { rule: "The vault always stays rent-exempt", error: "InsufficientVaultBalance", where: "on-chain" },
  { rule: "Malformed, ambiguous or non-SOL requests never reach Solana", error: "Rejected by the backend", where: "off-chain" },
];

export function Landing() {
  return (
    <main>
      <section className="relative grid items-center gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16 lg:pt-16 xl:pb-28">
        <div className="rise">
          <div className="flex flex-wrap items-center gap-3">
            <NetworkPill />
            <span className="label-mono text-faint">Policy-enforced payments for AI agents</span>
          </div>
          <h1 className="mt-7 text-balance">
            <span className="block font-display text-[42px] font-semibold leading-[0.98] tracking-[-0.02em] sm:text-[56px] xl:text-[66px]">
              Human control for
            </span>
            <span className="block font-serif text-[48px] italic leading-[1.04] tracking-[-0.01em] text-guard sm:text-[64px] xl:text-[76px]">
              autonomous money.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            IntentGuard lets an AI agent propose payments from a vault it can never empty on its own. A
            Solana program enforces your spending policy, and nothing moves until you approve it in Phantom.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="cta-wallet">
              <WalletMultiButton>Connect Phantom</WalletMultiButton>
            </div>
            <a
              href="#how"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-line-strong px-5 text-[15px] font-medium text-fg transition-colors hover:border-faint hover:bg-raised"
            >
              How it works <ArrowDown size={15} aria-hidden />
            </a>
          </div>
          <p className="mt-3 text-xs text-faint">
            Set Phantom to Devnet first, in its developer settings. Devnet SOL has no real value.
          </p>

          <dl className="mt-10 grid max-w-xl grid-cols-3 border-y border-line">
            {GUARANTEES.map(({ label, value }, i) => (
              <div key={label} className={`py-4 ${i > 0 ? "border-l border-line pl-4" : "pr-4"}`}>
                <dt className="label-mono text-faint">{label}</dt>
                <dd className="mt-1.5 text-sm font-medium leading-snug">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <PaymentPath />
      </section>

      <section id="how" className="scroll-mt-24 border-t border-line py-20 xl:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="label-mono text-guard">How it works</p>
            <h2 className="mt-4 font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.015em] sm:text-[44px]">
              Three parties.
              <br />
              <span className="font-serif text-[1.08em] font-normal italic text-muted">Nobody acts alone.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              The agent can ask. Only you can approve. And the program refuses anything outside your policy,
              whoever asks.
            </p>
          </div>

          <ol className="divide-y divide-line border-y border-line">
            {STEPS.map((step) => (
              <li key={step.n} className="grid gap-5 py-8 sm:grid-cols-[72px_minmax(0,1fr)]">
                <span className="font-mono text-[13px] font-medium text-guard">{step.n}</span>
                <div>
                  <h3 className="font-display text-[26px] font-semibold tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{step.text}</p>
                  <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-3">
                    {step.facts.map(([k, v]) => (
                      <div key={k}>
                        <dt className="label-mono text-faint">{k}</dt>
                        <dd className="mt-1 break-words font-mono text-[13px] text-fg">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="enforcement" className="scroll-mt-24 border-t border-line py-20 xl:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="label-mono text-guard">Enforcement</p>
            <h2 className="mt-4 font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.015em] sm:text-[44px]">
              What the program refuses.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              On-chain checks run inside the IntentGuard program on every proposal and every approval. The
              off-chain check only saves time and fees. It is never the line of defence.
            </p>
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-panel">
              <tr className="border-b border-line">
                <th scope="col" className="label-mono px-5 py-3 font-medium text-faint">Rule</th>
                <th scope="col" className="label-mono hidden px-5 py-3 font-medium text-faint md:table-cell">
                  Program error
                </th>
                <th scope="col" className="label-mono hidden px-5 py-3 text-right font-medium text-faint sm:table-cell">
                  Where
                </th>
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
      </section>

      <section className="flex flex-wrap items-center justify-between gap-6 border-t border-line py-12">
        <div>
          <p className="label-mono text-faint">Deployed program · Solana Devnet</p>
          <div className="mt-2 text-fg">
            <Address value={PROGRAM_ID.toBase58()} href={explorerAddress(PROGRAM_ID.toBase58())} size={10} />
          </div>
        </div>
        <a
          href={explorerAddress(PROGRAM_ID.toBase58())}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-guard underline-offset-4 hover:underline"
        >
          Inspect it on Solana Explorer <ArrowUpRight size={15} aria-hidden />
        </a>
      </section>
    </main>
  );
}

/**
 * Illustration of the payment path, labelled with the program's real instruction and
 * error names. Decorative: it shows no live data.
 */
function PaymentPath() {
  const nodes = [
    { cx: 72, n: "01", who: "AGENT", what: "proposes", code: "propose_payment" },
    { cx: 216, n: "02", who: "PROGRAM", what: "checks policy", gate: true },
    { cx: 360, n: "03", who: "OWNER", what: "signs in Phantom", code: "approve_and_execute", owner: true },
    { cx: 504, n: "04", who: "PROGRAM", what: "moves SOL", code: "vault → recipient" },
  ];
  return (
    <figure className="rise relative overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="label-mono text-faint">Payment path</span>
        <span className="label-mono text-faint">Illustration</span>
      </div>

      <div className="hidden px-3 pb-3 pt-6 sm:block">
        <svg viewBox="0 0 576 196" className="w-full" role="img" aria-labelledby="path-title">
          <title id="path-title">
            A proposal passes the program's policy check, waits for the owner's signature, then the program moves
            SOL. An over-limit proposal is rejected at the policy check.
          </title>

          <line x1="72" y1="72" x2="504" y2="72" stroke="var(--color-line-strong)" strokeWidth="1.5" />
          <path d="M216 86 V128" stroke="rgb(255 114 98 / 0.5)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />

          {nodes.map((node) => (
            <g key={node.n}>
              <text x={node.cx} y="16" textAnchor="middle" className="fill-guard font-mono" fontSize="11" letterSpacing="1">
                {node.n} {node.who}
              </text>
              <text x={node.cx} y="38" textAnchor="middle" className="fill-fg font-sans" fontSize="15" fontWeight="500">
                {node.what}
              </text>
              <circle
                cx={node.cx}
                cy="72"
                r="13"
                fill="var(--color-raised)"
                stroke="var(--color-line-strong)"
                strokeWidth="1.5"
                className={node.gate ? "gate-reject" : node.owner ? "owner-wait" : undefined}
              />
              <circle cx={node.cx} cy="72" r="3" className={node.gate ? "fill-muted" : "fill-faint"} />
              {node.code && (
                <text x={node.cx} y="108" textAnchor="middle" className="fill-muted font-mono" fontSize="10.5">
                  {node.code}
                </text>
              )}
            </g>
          ))}

          <rect x="126" y="128" width="180" height="52" rx="8" strokeWidth="1.5" className="chute-hit" stroke="rgb(255 114 98 / 0.35)" fill="rgb(44 21 18 / 0.5)" />
          <text x="216" y="148" textAnchor="middle" className="fill-danger font-mono" fontSize="11" letterSpacing="1">
            ✕ BLOCKED ON-CHAIN
          </text>
          <text x="216" y="166" textAnchor="middle" className="fill-muted font-mono" fontSize="11">
            AmountExceedsPolicyLimit
          </text>

          <circle cx="72" cy="72" r="5.5" className="packet-approved fill-guard" />
          <circle cx="72" cy="72" r="5.5" className="packet-blocked fill-danger" />
        </svg>
      </div>

      <ol className="space-y-3 px-5 py-5 sm:hidden">
        {nodes.map((node) => (
          <li key={node.n} className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-guard">{node.n}</span>
            <span className="text-sm">
              <span className="font-medium">{node.who.charAt(0) + node.who.slice(1).toLowerCase()}</span> {node.what}
              {node.code && <span className="block font-mono text-xs text-faint">{node.code}</span>}
            </span>
          </li>
        ))}
      </ol>

      <figcaption className="grid gap-3 border-t border-line px-5 py-4 text-[13px] sm:grid-cols-2">
        <span className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-guard" aria-hidden />
          <span className="text-muted">
            <span className="font-medium text-fg">Within policy:</span> waits for your signature, then moves.
          </span>
        </span>
        <span className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden />
          <span className="text-muted">
            <span className="font-medium text-fg">Outside policy:</span> rejected by the program. Nothing moves.
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
