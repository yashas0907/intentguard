/**
 * The IntentGuard mark: a vault dial split into three arcs (agent, owner, Solana)
 * around a locked core. No single arc closes the circle on its own.
 */
export function Emblem({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#111509" stroke="rgb(197 242 74 / 0.4)" />
      <g className={spin ? "dial-turn" : undefined}>
        <circle
          cx="16"
          cy="16"
          r="8.5"
          fill="none"
          stroke="#c5f24a"
          strokeWidth="2.4"
          strokeDasharray="15.8 2"
          transform="rotate(-80 16 16)"
        />
      </g>
      <circle cx="16" cy="16" r="2.6" fill="#c5f24a" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Emblem />
      <span className="text-[16px] font-semibold tracking-tight">IntentGuard</span>
    </span>
  );
}
