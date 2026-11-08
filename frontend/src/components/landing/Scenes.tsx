import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AgentNode, C, DocGlyph, KeyGlyph, SIGNATURE, Vault } from "./primitives";

/*
 * Five illustrations for the story, one composition each. Every scene renders its
 * final state when `animate` is false (reduced motion, or not yet on screen).
 */

type Anim = { className?: string; style?: CSSProperties };

/** Animation props only when animating; the final state otherwise. */
function A(on: boolean, cls: string, delay = 0, vars: Record<string, string | number> = {}): Anim {
  if (!on) return {};
  return { className: cls, style: { animationDelay: `${delay}s`, ...(vars as CSSProperties) } };
}

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ") || undefined;

function Svg({ label, children, h = 460 }: { label: string; children: ReactNode; h?: number }) {
  return (
    <svg viewBox={`0 0 540 ${h}`} className="block h-auto w-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

function Txt({ x, y, children, size = 14.5, fill = C.muted, anchor = "start", mono = false, weight, italic = false, serif = false, ...rest }: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  mono?: boolean;
  weight?: number;
  italic?: boolean;
  serif?: boolean;
} & Anim) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={fill}
      textAnchor={anchor}
      fontWeight={weight}
      fontStyle={italic ? "italic" : undefined}
      className={join(mono ? "font-mono" : serif ? "font-serif" : "font-sans", rest.className)}
      style={rest.style}
    >
      {children}
    </text>
  );
}

/** A label pinned onto a line, with a solid background that cuts the line. */
function Tag({ x, y, text, tone = C.guard, mono = false, anim }: { x: number; y: number; text: string; tone?: string; mono?: boolean; anim?: Anim }) {
  const w = text.length * (mono ? 7.5 : 7.2) + 26;
  return (
    <g className={anim?.className} style={anim?.style}>
      <rect x={x - w / 2} y={y - 13} width={w} height={26} rx={13} fill={C.ink} stroke={tone} strokeOpacity={0.55} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={mono ? 12.5 : 13.5} fill={C.fg} className={mono ? "font-mono" : "font-sans"}>
        {text}
      </text>
    </g>
  );
}

/* 1. The risk: an agent holding the key empties the wallet, and nobody is asked. */

export function SceneRisk({ animate }: { animate: boolean }) {
  const drains = [92, 162, 232, 302, 372];
  const [balance, setBalance] = useState(animate ? 10 : 0);
  useEffect(() => {
    if (!animate) {
      setBalance(0);
      return;
    }
    setBalance(10);
    const timers = drains.map((_, i) => window.setTimeout(() => setBalance(8 - i * 2), (1.15 + i * 0.32) * 1000));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  return (
    <Svg label="An AI agent holds a private key wired straight to a wallet. Five transfers to unknown addresses drain it from 10 SOL to zero, and the owner is never asked.">
      {/* The owner, absent from the loop. */}
      <g opacity={0.8}>
        <circle cx={96} cy={74} r={20} fill="none" stroke={C.faint} strokeDasharray="3 5" />
        <path d="M96 66 a5 5 0 1 1 0.01 0 M86 86 q10 -10 20 0" fill="none" stroke={C.faint} strokeWidth={1.4} strokeLinecap="round" />
        <Txt x={126} y={70} size={15.5} fill={C.muted}>You</Txt>
        <Txt x={126} y={88} size={13} fill={C.faint}>never asked</Txt>
      </g>

      <AgentNode x={96} y={232} r={36} tone="danger" active={animate} />
      <Txt x={96} y={300} anchor="middle" size={15.5} fill={C.fg} weight={500}>AI agent</Txt>
      <Txt x={96} y={318} anchor="middle" size={13} fill={C.danger}>holds the private key</Txt>

      {/* Key wired straight into the wallet: it signs and sends in one step. */}
      <path d="M134 232 H250" stroke={C.danger} strokeWidth={2} />
      <rect x={160} y={216} width={58} height={32} rx={8} fill={C.ink} stroke={C.danger} strokeOpacity={0.5} />
      <KeyGlyph x={190} y={232} s={1.3} color={C.danger} />
      <Txt x={190} y={204} anchor="middle" size={13} fill={C.danger}>signs and sends</Txt>

      <rect x={250} y={180} width={110} height={104} rx={14} fill={C.raised} stroke={C.danger} strokeWidth={1.5} />
      <Txt x={305} y={206} anchor="middle" size={13} fill={C.faint}>Wallet</Txt>
      <Txt x={305} y={240} anchor="middle" size={20} mono fill={balance === 0 ? C.danger : C.fg}>{balance.toFixed(2)}</Txt>
      <rect x={266} y={258} width={78} height={6} rx={3} fill={C.ink} />
      <rect
        x={266}
        y={258}
        width={78}
        height={6}
        rx={3}
        fill={C.danger}
        style={{ transformBox: "fill-box", transformOrigin: "left", transform: `scaleX(${Math.max(balance / 10, 0.001)})`, transition: "transform 0.3s ease" }}
      />
      <Txt x={305} y={302} anchor="middle" size={13} fill={C.faint}>SOL</Txt>

      {drains.map((y, i) => (
        <g key={y} {...A(animate, "appear", 1.0 + i * 0.32)}>
          <path d={`M360 232 C410 232 414 ${y} 452 ${y}`} fill="none" stroke={C.danger} strokeWidth={1.5} className={animate ? "flow-dash" : undefined} strokeDasharray={animate ? undefined : "4 8"} />
          <rect x={452} y={y - 13} width={26} height={26} rx={6} fill={C.ink} stroke={C.danger} strokeDasharray="3 3" />
          <Txt x={465} y={y + 4.5} anchor="middle" size={14.5} mono fill={C.danger}>?</Txt>
          <Txt x={488} y={y + 4.5} size={12.5} mono fill={C.muted}>−2 SOL</Txt>
        </g>
      ))}
      <Txt x={530} y={60} anchor="end" size={13} fill={C.faint}>Unknown addresses</Txt>

      <g {...A(animate, "appear", 2.9)}>
        <Txt x={270} y={430} anchor="middle" size={14.5} fill={C.danger}>No policy. No review. No second check.</Txt>
      </g>
    </Svg>
  );
}

/* 2. The boundary: funds move behind the program's wall; the agent can only post a proposal. */

export function SceneBoundary({ animate }: { animate: boolean }) {
  return (
    <Svg label="A program boundary surrounds the vault. The agent, with no key to the vault, can only post a proposal at the boundary's edge. The boundary carries three rules: one agent, one recipient, at most 0.5 SOL per payment.">
      <rect
        x={190}
        y={58}
        width={322}
        height={352}
        rx={26}
        fill="var(--color-guard)"
        fillOpacity={0.025}
        stroke={C.guard}
        strokeWidth={1.6}
        pathLength={1}
        className={join("ink", animate && "ink-animate")}
        style={animate ? { animationDuration: "1.5s", animationDelay: "0.1s" } : undefined}
      />
      <g {...A(animate, "appear", 0.9)}>
        <Txt x={214} y={98} size={14.5} fill={C.guard}>IntentGuard program</Txt>
        <Txt x={214} y={116} size={13} fill={C.faint}>holds the vault, enforces the policy</Txt>
      </g>

      <g {...A(animate, "appear", 0.6)}>
        <Vault x={352} y={240} r={58} />
        <Txt x={352} y={334} anchor="middle" size={15.5} fill={C.fg} weight={500}>Vault</Txt>
        <Txt x={352} y={352} anchor="middle" size={13} fill={C.faint}>owned by the program</Txt>
      </g>

      {/* The agent, outside, with no key to the vault. */}
      <AgentNode x={82} y={240} r={32} />
      <Txt x={82} y={306} anchor="middle" size={15.5} fill={C.fg} weight={500}>AI agent</Txt>
      <Txt x={82} y={324} anchor="middle" size={13} fill={C.sys}>can propose only</Txt>
      <g {...A(animate, "appear", 1.2)}>
        <KeyGlyph x={82} y={150} s={1.3} color={C.faint} strike />
        <Txt x={82} y={122} anchor="middle" size={13} fill={C.faint}>no key to the vault</Txt>
      </g>

      {/* The one opening: a slot where proposals are posted. */}
      <rect x={185} y={222} width={10} height={36} rx={3} fill={C.ink} stroke={C.sys} strokeWidth={1.5} />
      <path d="M116 240 H150" stroke={C.sys} strokeOpacity={0.5} strokeDasharray="3 5" />
      <g {...A(animate, "travel", 1.6, { "--fx": "-46px", "--fy": "0px" })}>
        <DocGlyph x={166} y={240} s={0.95} />
      </g>
      <Tag x={190} y={290} text="propose_payment" tone={C.sys} mono anim={A(animate, "appear", 1.9)} />

      <Tag x={290} y={58} text="One agent" anim={A(animate, "appear", 1.5)} />
      <Tag x={420} y={58} text="One recipient" anim={A(animate, "appear", 1.7)} />
      <Tag x={351} y={410} text="At most 0.5 SOL per payment" anim={A(animate, "appear", 1.9)} />
    </Svg>
  );
}

/* 3. The signature: the owner's key writes the approval, then the gate opens. */

/** The 64 bytes of the owner's real approval on Devnet, decoded from 3MG4XC…TV9oM. */
const APPROVAL_BYTES = [
  117, 129, 82, 122, 215, 58, 34, 101, 189, 192, 176, 141, 239, 205, 233, 76, 20, 248, 149, 202, 198, 155, 208, 169, 43, 169,
  24, 155, 222, 184, 139, 96, 141, 46, 191, 225, 213, 147, 114, 44, 75, 171, 136, 172, 204, 158, 222, 76, 132, 7, 96, 144,
  253, 149, 171, 140, 177, 35, 161, 201, 47, 247, 219, 0,
];

export function SceneSignature({ animate }: { animate: boolean }) {
  const signedAt = 2.3;
  return (
    <Svg label="The owner's key seal writes a signature. When it is complete the gate opens and the pending proposal is approved. Below, the 64 bytes of a real owner approval signature from Solana Devnet.">
      {/* The proposal waiting for a decision. */}
      {animate && (
        <g className="fade-out" style={{ animationDelay: `${signedAt}s` }}>
          <rect x={70} y={32} width={400} height={38} rx={19} fill="var(--color-warn-dim)" stroke={C.warn} strokeOpacity={0.6} />
          <circle cx={94} cy={51} r={4} fill={C.warn} />
          <Txt x={110} y={56} size={14} fill={C.fg}>Pending: 0.01 SOL to the approved recipient</Txt>
        </g>
      )}
      <g {...A(animate, "appear", signedAt)}>
        <rect x={70} y={32} width={400} height={38} rx={19} fill="var(--color-guard-dim)" stroke={C.guard} strokeOpacity={0.6} />
        <path d="M89 51 l3.5 3.5 l6.5 -7" fill="none" stroke={C.guard} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Txt x={110} y={56} size={14} fill={C.fg}>Approved: 0.01 SOL to the approved recipient</Txt>
      </g>

      {/* The owner's seal. */}
      <g>
        <circle cx={104} cy={196} r={66} fill="none" stroke={C.warn} strokeOpacity={0.25} strokeDasharray="2 6" className="orbit" />
        <circle cx={104} cy={196} r={52} fill={C.raised} stroke={C.warn} strokeWidth={1.6} />
        <circle cx={104} cy={196} r={52} fill="none" stroke={C.guard} strokeWidth={1.8} {...A(animate, "appear", signedAt)} />
        <circle cx={104} cy={196} r={38} fill="none" stroke={C.warn} strokeOpacity={0.4} />
        <KeyGlyph x={103} y={196} s={1.9} color={C.fg} />
        <Txt x={104} y={284} anchor="middle" size={15.5} fill={C.fg} weight={500}>Your key</Txt>
        <Txt x={104} y={302} anchor="middle" size={13} fill={C.faint}>in Phantom, never shared</Txt>
      </g>

      {/* The signature, written stroke by stroke. */}
      <path
        d={SIGNATURE}
        transform="translate(186 150) scale(1.3)"
        pathLength={1}
        fill="none"
        stroke={C.guard}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={join("ink", animate && "ink-animate")}
        style={animate ? { animationDuration: "1.6s", animationDelay: "0.5s" } : undefined}
      />
      <path d="M186 238 H462" stroke={C.line} strokeDasharray="3 5" />
      <Txt x={186} y={264} size={22} serif italic fill={C.muted}>Your signature</Txt>
      <Txt x={462} y={262} anchor="end" size={12} mono fill={C.faint}>ed25519</Txt>

      {/* The gate it opens. */}
      <g>
        <path d="M500 118 V156 M500 236 V274" stroke={C.line} strokeWidth={1.5} />
        <path d="M470 196 H540" stroke={C.guard} strokeWidth={2} {...A(animate, "appear", signedAt + 0.45)} />
        {(["door-a", "door-b"] as const).map((cls, i) => (
          <rect
            key={cls}
            x={495.5}
            y={i === 0 ? 160 : 196}
            width={9}
            height={36}
            rx={2}
            fill={animate ? C.fg : C.guard}
            className={animate ? cls : undefined}
            style={animate ? { animationDelay: `${signedAt}s`, ["--shift" as string]: "30px" } : { transform: `translateY(${i === 0 ? -30 : 30}px)` }}
          />
        ))}
        <Txt x={500} y={296} anchor="middle" size={13} fill={C.faint}>Owner gate</Txt>
      </g>

      {/* Real bytes, so the drawing doesn't invent a signature. */}
      <g>
        {APPROVAL_BYTES.map((byte, i) => {
          const col = i % 16;
          const row = Math.floor(i / 16);
          return (
            <rect
              key={i}
              x={62 + col * 26}
              y={340 + row * 17}
              width={22}
              height={12}
              rx={2}
              fill={C.guard}
              fillOpacity={0.1 + (byte / 255) * 0.75}
              {...A(animate, "appear", signedAt - 0.2 + i * 0.012)}
            />
          );
        })}
        <Txt x={62} y={428} size={13} fill={C.faint}>
          64 bytes of the real owner approval on Devnet
        </Txt>
        <Txt x={478} y={428} anchor="end" size={12.5} mono fill={C.muted}>3MG4XC…TV9oM</Txt>
      </g>
    </Svg>
  );
}

/* 4. Enforcement: two pipelines in the program, reading the same policy. */

const PROPOSE_CHECKS = ["Agent authorized", "Recipient approved", "Within the limit", "Vault can cover it", "Nothing else pending"];
const APPROVE_CHECKS = ["Owner signed", "Still pending", "Same proposal", "Agent authorized", "Recipient approved", "Within the limit", "Vault can cover it"];

function Pipeline({ x, top, gap, checks, start, step, tone, animate }: { x: number; top: number; gap: number; checks: string[]; start: number; step: number; tone: string; animate: boolean }) {
  const bottom = top + gap * (checks.length - 1);
  const travel = step * checks.length;
  return (
    <g>
      <path d={`M${x} ${top - 18} V${bottom + 26}`} stroke={C.line} strokeWidth={1.5} />
      <path
        d={`M${x} ${top - 18} V${bottom + 26}`}
        stroke={tone}
        strokeWidth={2}
        pathLength={1}
        className={join("ink", animate && "ink-animate")}
        style={animate ? { animationDuration: `${travel}s`, animationDelay: `${start}s`, animationTimingFunction: "linear" } : undefined}
      />
      {checks.map((label, i) => {
        const y = top + i * gap;
        return (
          <g key={label}>
            <circle cx={x} cy={y} r={10} fill={C.ink} stroke={C.line} strokeWidth={1.5} />
            <g {...A(animate, "check-animate", start + (i + 0.5) * step)}>
              <circle cx={x} cy={y} r={10} fill="var(--color-guard-dim)" stroke={C.guard} strokeWidth={1.5} />
              <path d={`M${x - 4} ${y} l3 3.2 l5.5 -6.2`} fill="none" stroke={C.guard} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <Txt x={x + 20} y={y + 4.5} size={14.5} fill={C.muted}>{label}</Txt>
          </g>
        );
      })}
      {animate && (
        <circle cx={x} cy={top - 18} r={5} fill={tone} className="descend" style={{ ["--dy" as string]: `${bottom + 44 - top}px`, animationDuration: `${travel}s`, animationDelay: `${start}s` }} />
      )}
    </g>
  );
}

export function SceneChecks({ animate }: { animate: boolean }) {
  return (
    <Svg h={490} label="Two pipelines inside the IntentGuard program read the same policy from the vault account. propose_payment, signed by the agent, checks five rules and records a pending proposal. approve_and_execute_payment, signed by the owner, checks seven rules and releases the SOL.">
      <rect x={176} y={14} width={188} height={70} rx={12} fill={C.raised} stroke={C.line} />
      <Txt x={194} y={40} size={14.5} fill={C.fg} weight={500}>Vault account</Txt>
      <Txt x={194} y={60} size={12.5} mono fill={C.muted}>limit 0.5 SOL</Txt>
      <Txt x={194} y={75} size={12.5} mono fill={C.faint}>1 agent, 1 recipient</Txt>
      <path d="M226 84 V98 H76 V112 M314 84 V98 H292 V112" fill="none" stroke={C.line} strokeDasharray="3 5" />
      <Txt x={352} y={108} size={12} fill={C.faint}>same policy, read twice</Txt>

      <Txt x={64} y={136} size={13} mono fill={C.sys}>propose_payment</Txt>
      <Txt x={64} y={154} size={13} fill={C.faint}>signed by the agent</Txt>
      <Pipeline x={76} top={196} gap={44} checks={PROPOSE_CHECKS} start={0.3} step={0.28} tone={C.sys} animate={animate} />
      <g {...A(animate, "appear", 0.3 + 0.28 * 5 + 0.2)}>
        <rect x={56} y={406} width={168} height={30} rx={15} fill="var(--color-warn-dim)" stroke={C.warn} strokeOpacity={0.6} />
        <Txt x={140} y={425.5} anchor="middle" size={13.5} fill={C.fg}>Recorded as pending</Txt>
      </g>

      <Txt x={280} y={136} size={13} mono fill={C.guard}>approve_and_execute_payment</Txt>
      <Txt x={280} y={154} size={13} fill={C.faint}>signed by you</Txt>
      <Pipeline x={292} top={196} gap={36} checks={APPROVE_CHECKS} start={2.3} step={0.24} tone={C.guard} animate={animate} />
      <g {...A(animate, "appear", 2.3 + 0.24 * 7 + 0.2)}>
        <rect x={272} y={444} width={168} height={30} rx={15} fill="var(--color-guard-dim)" stroke={C.guard} strokeOpacity={0.6} />
        <Txt x={356} y={463.5} anchor="middle" size={13.5} fill={C.fg}>0.01 SOL released</Txt>
      </g>
    </Svg>
  );
}

/* 5. The verdict: two lanes, one cleared and one refused. */

function LaneGate({ x, y, mode, delay, animate }: { x: number; y: number; mode: "opens" | "refuses"; delay: number; animate: boolean }) {
  const final = mode === "opens" ? C.guard : C.danger;
  const doors = [
    { y: y - 30, cls: "door-a", rest: "translateY(-22px)" },
    { y, cls: "door-b", rest: "translateY(22px)" },
  ];
  return (
    <g>
      {doors.map((d, i) =>
        mode === "opens" ? (
          <rect
            key={i}
            x={x - 4.5}
            y={d.y}
            width={9}
            height={30}
            rx={2}
            fill={animate ? C.fg : final}
            className={animate ? d.cls : undefined}
            style={animate ? { animationDelay: `${delay}s`, ["--shift" as string]: "22px" } : { transform: d.rest }}
          />
        ) : (
          <rect key={i} x={x - 4.5} y={d.y} width={9} height={30} rx={2} fill={animate ? C.fg : final} className={animate ? "door-refuse" : undefined} style={animate ? { animationDelay: `${delay}s` } : undefined} />
        )
      )}
    </g>
  );
}

function LaneChip({ x, y, label, tone, anim }: { x: number; y: number; label: string; tone: string; anim: Anim }) {
  return (
    <g className={anim.className} style={anim.style}>
      <rect x={x - 38} y={y - 12} width={76} height={24} rx={12} fill={C.raised} stroke={tone} strokeWidth={1.5} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={12} fill={C.fg} className="font-mono">
        {label}
      </text>
    </g>
  );
}

export function SceneOutcome({ animate }: { animate: boolean }) {
  return (
    <Svg h={470} label="Two lanes. Inside the policy, a 0.01 SOL request passes the open gate after the owner signs and reaches the recipient: executed. Outside the policy, a 5 SOL request hits the closed gate and is refused on-chain with AmountExceedsPolicyLimit; nothing moves.">
      {/* Cleared */}
      <Txt x={20} y={38} size={14.5} fill={C.guard}>Inside the policy</Txt>
      <path d="M96 104 H452" stroke={C.line} strokeWidth={1.5} />
      <path d="M96 104 H452" stroke={C.guard} strokeWidth={2} pathLength={1} className={join("ink", animate && "ink-animate")} style={animate ? { animationDuration: "1.8s", animationDelay: "0.4s", animationTimingFunction: "linear" } : undefined} />
      <AgentNode x={44} y={104} r={20} />
      <LaneGate x={236} y={104} mode="opens" delay={0.75} animate={animate} />
      <path d={SIGNATURE} transform="translate(150 58) scale(0.34)" pathLength={1} fill="none" stroke={C.guard} strokeWidth={4.5} strokeLinecap="round" className={join("ink", animate && "ink-animate")} style={animate ? { animationDuration: "0.7s", animationDelay: "0.2s" } : undefined} />
      <rect x={452} y={80} width={48} height={48} rx={10} fill="var(--color-guard-dim)" stroke={C.guard} strokeWidth={1.6} {...A(animate, "appear", 2.1)} />
      <rect x={452} y={80} width={48} height={48} rx={10} fill="none" stroke={C.line} strokeWidth={1.6} opacity={animate ? 1 : 0} />
      <LaneChip x={animate ? 140 : 360} y={104} label="0.01 SOL" tone={C.guard} anim={A(animate, "lane-pass", 0.3, { "--x1": "40px", "--x2": "336px" })} />
      <Txt x={20} y={196} size={52} serif fill={C.guard} {...A(animate, "appear", 2.2)}>+0.01 SOL</Txt>
      <Txt x={520} y={172} anchor="end" size={15.5} fill={C.fg} weight={500} {...A(animate, "appear", 2.3)}>Executed</Txt>
      <Txt x={520} y={192} anchor="end" size={12.5} mono fill={C.muted} {...A(animate, "appear", 2.3)}>3MG4XC…TV9oM</Txt>

      <path d="M0 236 H540" stroke={C.line} />

      {/* Refused */}
      <Txt x={20} y={276} size={14.5} fill={C.danger}>Outside the policy</Txt>
      <path d="M96 342 H230" stroke={C.line} strokeWidth={1.5} />
      <path d="M242 342 H452" stroke={C.line} strokeWidth={1.5} strokeDasharray="3 6" />
      <AgentNode x={44} y={342} r={20} />
      <LaneGate x={236} y={342} mode="refuses" delay={1.25} animate={animate} />
      <rect x={452} y={318} width={48} height={48} rx={10} fill="none" stroke={C.line} strokeDasharray="3 4" />
      <Txt x={476} y={386} anchor="middle" size={12} fill={C.faint}>never reached</Txt>
      <LaneChip x={animate ? 140 : 176} y={342} label="5 SOL" tone={C.danger} anim={A(animate, "lane-bounce", 0.5, { "--x1": "48px" })} />
      <g {...A(animate, "appear", 1.4)}>
        <circle cx={236} cy={302} r={11} fill="var(--color-danger-dim)" stroke={C.danger} strokeWidth={1.5} />
        <path d="M232 298 l8 8 M240 298 l-8 8" stroke={C.danger} strokeWidth={2} strokeLinecap="round" />
      </g>
      <Txt x={20} y={438} size={52} serif fill={C.danger} {...A(animate, "appear", 2.0)}>0 SOL moved</Txt>
      <Txt x={520} y={410} anchor="end" size={12.5} mono fill={C.danger} {...A(animate, "appear", 2.1)}>AmountExceedsPolicyLimit</Txt>
      <Txt x={520} y={430} anchor="end" size={12.5} mono fill={C.muted} {...A(animate, "appear", 2.1)}>3mhXjR…8qEGw</Txt>
    </Svg>
  );
}
