import type { CSSProperties } from "react";

/** Shared vocabulary for the landing illustrations: nodes, keys, gates, vaults, checks. */
export const C = {
  guard: "var(--color-guard)",
  sys: "var(--color-sys)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
  fg: "var(--color-fg)",
  muted: "var(--color-muted)",
  faint: "var(--color-faint)",
  line: "var(--color-line-strong)",
  raised: "var(--color-raised)",
  ink: "var(--color-ink)",
};

export type Tone = "guard" | "sys" | "warn" | "danger" | "fg" | "faint";

export const SIGNATURE =
  "M6 40 C14 14 30 8 28 34 C26 52 40 50 50 30 C58 14 66 12 66 30 C66 44 76 46 86 30 C94 18 104 16 104 32 C104 44 114 44 124 32 C132 22 142 18 146 30 C150 42 160 44 172 30 L208 22";

export const d = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

function hexPoints(x: number, y: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** The agent: a process core. Never a robot. */
export function AgentNode({ x, y, r = 40, active = false, tone = "sys" }: { x: number; y: number; r?: number; active?: boolean; tone?: Tone }) {
  const color = C[tone];
  return (
    <g>
      <circle cx={x} cy={y} r={r + 15} fill="none" stroke={color} strokeOpacity={0.35} strokeDasharray="2 7" className="orbit" />
      <polygon points={hexPoints(x, y, r)} fill={C.raised} stroke={color} strokeWidth={1.6} />
      <polygon points={hexPoints(x, y, r * 0.56)} fill="none" stroke={color} strokeOpacity={0.45} />
      <circle cx={x} cy={y} r={r * 0.17} fill={color} className={active ? "glow-pulse" : undefined} />
    </g>
  );
}

export function KeyGlyph({ x, y, s = 1, color, strike = false }: { x: number; y: number; s?: number; color: string; strike?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <circle cx={-8} cy={0} r={6} vectorEffect="non-scaling-stroke" />
        <path d="M-2 0 H15 M10 0 V5 M14 0 V4" vectorEffect="non-scaling-stroke" />
      </g>
      {strike && <path d="M-16 9 L19 -9" stroke={C.danger} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </g>
  );
}

/** A proposal: a small drafted document. */
export function DocGlyph({ x, y, s = 1, color = C.sys, className, style }: { x: number; y: number; s?: number; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={className} style={style}>
        <path d="M-12 -16 H6 L12 -10 V16 H-12 Z" fill={C.raised} stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d="M6 -16 V-10 H12" fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <path d="M-7 -4 H7 M-7 2 H7 M-7 8 H2" stroke={color} strokeOpacity={0.6} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      </g>
    </g>
  );
}

/** The vault: a dial with fine ticks, echoing the IntentGuard emblem. */
export function Vault({ x, y, r = 50, color = C.guard, active = false, label = true }: { x: number; y: number; r?: number; color?: string; active?: boolean; label?: boolean }) {
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const r1 = r + 4;
    const r2 = r + (i % 3 === 0 ? 10 : 7);
    return `M${(x + r1 * Math.cos(a)).toFixed(1)} ${(y + r1 * Math.sin(a)).toFixed(1)} L${(x + r2 * Math.cos(a)).toFixed(1)} ${(y + r2 * Math.sin(a)).toFixed(1)}`;
  }).join("");
  return (
    <g>
      {active && <circle cx={x} cy={y} r={r + 18} fill={color} fillOpacity={0.08} className="glow-pulse" />}
      <path d={ticks} stroke={color} strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={x} cy={y} r={r} fill={C.raised} stroke={color} strokeWidth={1.6} />
      <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke={color} strokeOpacity={0.4} strokeDasharray="14 5" />
      <circle cx={x} cy={y} r={r * 0.44} fill="none" stroke={color} strokeOpacity={0.6} />
      {label && (
        <text x={x} y={y + 5} textAnchor="middle" fill={C.fg} fontSize={Math.max(11, r * 0.28)} className="font-mono">
          SOL
        </text>
      )}
    </g>
  );
}

export type GateState = "closed" | "open" | "fail";

/** The security gate: two doors on the program's boundary. */
export function Gate({ x, y, orient = "v", state, size = 34 }: { x: number; y: number; orient?: "v" | "h"; state: GateState; size?: number }) {
  const color = state === "fail" ? C.danger : state === "open" ? C.guard : C.fg;
  const shift = state === "open" ? size * 0.82 : 0;
  const t = 9;
  const doors =
    orient === "v"
      ? [
          { x: x - t / 2, y: y - size, w: t, h: size, tf: `translate(0px, ${-shift}px)` },
          { x: x - t / 2, y, w: t, h: size, tf: `translate(0px, ${shift}px)` },
        ]
      : [
          { x: x - size, y: y - t / 2, w: size, h: t, tf: `translate(${-shift}px, 0px)` },
          { x, y: y - t / 2, w: size, h: t, tf: `translate(${shift}px, 0px)` },
        ];
  return (
    <g className={state === "fail" ? "shake" : undefined}>
      {doors.map((door, i) => (
        <rect
          key={i}
          x={door.x}
          y={door.y}
          width={door.w}
          height={door.h}
          rx={2}
          fill={color}
          fillOpacity={state === "closed" ? 0.75 : 0.9}
          style={{ transform: door.tf, transition: "transform 0.55s cubic-bezier(0.3, 0.7, 0.2, 1), fill 0.3s" }}
        />
      ))}
    </g>
  );
}

export type CheckState = "idle" | "ok" | "fail";

export function CheckNode({ x, y, state, label, r = 11, fontSize = 13 }: { x: number; y: number; state: CheckState; label?: string; r?: number; fontSize?: number }) {
  const color = state === "ok" ? C.guard : state === "fail" ? C.danger : C.line;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={state === "idle" ? C.ink : state === "ok" ? "var(--color-guard-dim)" : "var(--color-danger-dim)"} stroke={color} strokeWidth={1.5} style={{ transition: "stroke 0.25s, fill 0.25s" }} />
      {state === "ok" && <path d={`M${x - r * 0.42} ${y} l${r * 0.3} ${r * 0.32} l${r * 0.55} ${-r * 0.62}`} fill="none" stroke={C.guard} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {state === "fail" && <path d={`M${x - r * 0.38} ${y - r * 0.38} l${r * 0.76} ${r * 0.76} M${x + r * 0.38} ${y - r * 0.38} l${-r * 0.76} ${r * 0.76}`} stroke={C.danger} strokeWidth={2} strokeLinecap="round" />}
      {label && (
        <text x={x} y={y + r + fontSize + 4} textAnchor="middle" fill={state === "idle" ? C.faint : state === "ok" ? C.muted : C.danger} fontSize={fontSize} className="font-sans">
          {label}
        </text>
      )}
    </g>
  );
}
