import { Check, Copy, ExternalLink, Loader2, ShieldCheck, Waypoints } from "lucide-react";
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useState } from "react";
import { shorten } from "../lib/chain";
import type { TxResult } from "../lib/useSendTransaction";

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rise rounded-xl border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {aside}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Marks where a check really happens, so nothing off-chain passes as enforcement. */
export function EnforcementTag({ where }: { where: "on-chain" | "off-chain" }) {
  return where === "on-chain" ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-guard-dim px-1.5 py-0.5 text-[11px] font-medium text-guard">
      <ShieldCheck size={12} /> Enforced on-chain
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line-strong px-1.5 py-0.5 text-[11px] font-medium text-muted">
      <Waypoints size={12} /> Off-chain check
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
};

export function Button({ variant = "primary", busy, children, className = "", disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: "bg-guard text-ink hover:brightness-110",
    secondary: "border border-line-strong bg-raised text-fg hover:bg-line",
    danger: "border border-danger/40 text-danger hover:bg-danger-dim",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guard disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
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
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        {...input}
        className="h-10 w-full rounded-lg border border-line bg-ink px-3 font-mono text-[13px] text-fg outline-none transition placeholder:text-faint focus:border-guard read-only:text-muted"
      />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
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
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-guard hover:underline">
          {shorten(value, size)}
        </a>
      ) : (
        shorten(value, size)
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value}`}
        className="text-faint transition hover:text-fg"
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
      className="inline-flex items-center gap-1 text-sm font-medium text-guard hover:underline"
    >
      {children} <ExternalLink size={13} />
    </a>
  );
}

export function TxNotice({ result }: { result: TxResult | null }) {
  if (!result) return null;
  return result.kind === "success" ? (
    <div className="rise mt-3 rounded-lg border border-guard/30 bg-guard-dim/50 p-3 text-sm" role="status">
      <p className="font-medium text-guard">{result.label}: confirmed on Devnet</p>
      <div className="mt-1">
        <ExplorerLink href={result.url} />
      </div>
    </div>
  ) : (
    <div className="rise mt-3 rounded-lg border border-danger/30 bg-danger-dim/50 p-3 text-sm" role="alert">
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
