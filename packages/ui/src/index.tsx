import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-fg-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-hg border border-border bg-surface p-4 sm:p-5", className)}>{children}</section>;
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-hg px-4 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-border bg-surface hover:bg-surface-muted",
        variant === "ghost" && "hover:bg-surface-muted",
        className,
      )}
    />
  );
}

export function Input({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-sm", className)}>
      <span className="text-fg-muted">{label}</span>
      <input {...props} className="min-h-11 w-full rounded-hg border border-border bg-surface px-3 text-base text-fg" />
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-muted text-fg-muted",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "accent" && "bg-accent/15 text-accent",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-hg border border-dashed border-border p-6 text-center text-fg-muted">{children}</p>;
}

export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <p role="status" className={cn("rounded-hg px-3 py-2 text-sm", tone === "danger" ? "bg-danger/10 text-danger" : "bg-surface-muted text-fg-muted")}>
      {children}
    </p>
  );
}
