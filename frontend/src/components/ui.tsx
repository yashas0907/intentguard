import { Check, Copy, ExternalLink, Loader2, ShieldCheck, Waypoints } from "lucide-react";
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useState } from "react";
import { shorten } from "../lib/chain";
import type { TxResult } from "../lib/useSendTransaction";

export function Panel({
  title,
  eyebrow,
  aside,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  eyebrow?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rise relative rounded-xl border border-line bg-panel shadow-[0_1px_0_rgb(255_255_255/0.03)_inset,0_20px_40px_-24px_rgb(0_0_0/0.6)] ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="label-sm mb-0.5 text-faint">{eyebrow}</p>}
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          </div>
          {aside}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Marks where a check really happens, so nothing off-chain passes as enforcement. */
export function EnforcementTag({ where }: { where: "on-chain" | "off-chain" }) {
  return where === "on-chain" ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-guard/25 bg-guard-dim px-1.5 py-0.5 text-[11px] font-medium text-guard">
      <ShieldCheck size={12} aria-hidden /> Enforced on-chain
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line-strong px-1.5 py-0.5 text-[11px] font-medium text-muted">
      <Waypoints size={12} aria-hidden /> Off-chain check
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
};

export function Button({ variant = "primary", busy, children, className = "", disabled, ...rest }: ButtonProps) {
  const styles = {
    primary:
      "bg-guard text-ink shadow-[0_0_0_1px_rgb(197_242_74/0.4),0_8px_24px_-12px_rgb(197_242_74/0.55)] hover:bg-[#d4f86d]",
    secondary: "border border-line-strong bg-raised text-fg hover:border-faint hover:bg-line",
    danger: "border border-danger/40 text-danger hover:border-danger/70 hover:bg-danger-dim",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${styles} ${className}`}
    >
      {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="label-sm mb-1.5 block text-faint">{label}</span>
      <input
        {...input}
        className="h-10 w-full rounded-lg border border-line bg-ink px-3 font-mono text-[13px] text-fg outline-none transition-colors placeholder:text-faint/70 hover:border-line-strong focus:border-guard/70 focus:bg-[#090c0e] read-only:text-muted"
      />
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

export function Address({ value, href, size = 4 }: { value: string; href?: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* Clipboard can be blocked; the Explorer link still works. */
    }
  };
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[13px]" title={value}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="underline-offset-4 transition-colors hover:text-guard hover:underline">
          {shorten(value, size)}
        </a>
      ) : (
        shorten(value, size)
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value}`}
        className="text-faint transition-colors hover:text-fg"
      >
        {copied ? <Check size={13} className="text-guard" /> : <Copy size={13} />}
      </button>
    </span>
  );
}

export function ExplorerLink({ href, children = "View on Solana Explorer" }: { href: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-guard underline-offset-4 hover:underline"
    >
      {children} <ExternalLink size={13} aria-hidden />
    </a>
  );
}

export function TxNotice({ result }: { result: TxResult | null }) {
  if (!result) return null;
  return result.kind === "success" ? (
    <div className="rise mt-3 rounded-lg border border-guard/30 bg-guard-dim/60 p-3 text-sm" role="status">
      <p className="flex items-center gap-1.5 font-medium text-guard">
        <Check size={15} aria-hidden /> {result.label}: confirmed on Devnet
      </p>
      <div className="mt-1">
        <ExplorerLink href={result.url} />
      </div>
    </div>
  ) : (
    <div className="rise mt-3 rounded-lg border border-danger/30 bg-danger-dim/60 p-3 text-sm" role="alert">
      <p className="font-medium text-danger">{result.label}: not completed</p>
      <p className="mt-0.5 break-words text-muted">{result.message}</p>
      {result.url && (
        <div className="mt-1">
          <ExplorerLink href={result.url} />
        </div>
      )}
    </div>
  );
}

/** Network indicator. The app only ever talks to Solana Devnet. */
export function NetworkPill() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-sys/25 bg-sys-dim px-2 py-1 text-[11px] font-medium text-sys">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-sys" aria-hidden />
      Solana Devnet
    </span>
  );
}
