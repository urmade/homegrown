"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from "react";

export {
  applyResolvedTheme,
  parseThemePref,
  readStoredThemePref,
  resolveTheme,
  systemPrefersDark,
  THEME_BOOT_SCRIPT,
  THEME_EVENT,
  THEME_KEY,
  writeStoredThemePref,
} from "./theme";
export type { ThemePref, ThemeResolved } from "./theme";

const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export type AppBarExtras = { title?: ReactNode; trailing?: ReactNode };

const AppBarSet = createContext<(next: AppBarExtras) => void>(() => {});
const AppBarGet = createContext<AppBarExtras>({});

export function AppBarProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<AppBarExtras>({});
  return (
    <AppBarSet.Provider value={setExtras}>
      <AppBarGet.Provider value={extras}>{children}</AppBarGet.Provider>
    </AppBarSet.Provider>
  );
}

export function useAppBarExtras() {
  return useContext(AppBarGet);
}

export function useAppBar(extras: AppBarExtras, deps: readonly unknown[]) {
  const set = useContext(AppBarSet);
  useEffect(() => {
    set(extras);
    return () => set({});
  }, deps);
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 hidden h-16 min-w-0 items-center justify-between gap-3 md:flex">
      <h1 className="min-w-0 truncate text-[length:var(--hg-text-title)] leading-7 font-bold tracking-tight">{title}</h1>
      {description ? <span className="sr-only">{description}</span> : null}
      {action}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-hg border border-border bg-surface p-4 shadow-[var(--hg-shadow-1)]", className)}>{children}</section>
  );
}

export function Columns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">{main}</div>
      <div className="min-w-0">{aside}</div>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--hg-radius-md)] px-4 text-[length:var(--hg-text-callout)] leading-5 font-semibold whitespace-nowrap transition-[opacity,background-color] duration-[var(--hg-dur-fast)] disabled:opacity-40",
        variant === "primary" && "bg-primary text-on-primary",
        variant === "secondary" && "border border-border-strong bg-surface text-fg",
        variant === "ghost" && "bg-transparent text-primary",
        className,
      )}
    />
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type="button"
      {...props}
      className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-surface-sunken", className)}
    />
  );
}

export function TextField({
  label,
  error,
  hint,
  className,
  id,
  inputRef,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; inputRef?: Ref<HTMLInputElement> }) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 text-[length:var(--hg-text-footnote)] font-semibold", className)}>
      <label htmlFor={inputId} className="text-fg">
        {label}
      </label>
      <input
        {...props}
        ref={inputRef}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        className="h-11 w-full rounded-[var(--hg-radius-md)] border border-border-strong bg-surface px-3 text-base text-fg"
      />
      {(error || hint) && (
        <span id={hintId} className={cn("font-medium", error ? "text-danger" : "text-fg-muted")}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; inputRef?: Ref<HTMLInputElement> },
) {
  return <TextField {...props} />;
}

export function Select({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }) {
  const auto = useId();
  const selectId = id ?? auto;
  const hintId = `${selectId}-hint`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 text-[length:var(--hg-text-footnote)] font-semibold", className)}>
      <label htmlFor={selectId} className="text-fg">
        {label}
      </label>
      <select
        {...props}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        className="h-11 w-full rounded-[var(--hg-radius-md)] border border-border-strong bg-surface px-3 text-base text-fg"
      >
        {children}
      </select>
      {(error || hint) && (
        <span id={hintId} className={cn("font-medium", error ? "text-danger" : "text-fg-muted")}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-sunken text-fg-muted",
        tone === "warn" && "bg-warn text-on-primary",
        tone === "accent" && "bg-primary text-on-primary",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-hg border border-dashed border-border p-6 text-center text-base text-fg-muted">{children}</p>;
}

export function Banner({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <p role="status" data-tone={tone} className="hg-banner flex items-center gap-3 rounded-[var(--hg-radius-md)] px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

export function Notice(props: { children: ReactNode; tone?: "neutral" | "danger" }) {
  return <Banner {...props} />;
}

export function SegmentedControl({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex min-h-11 items-center rounded-[var(--hg-radius-md)] bg-surface-sunken p-0.5"
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-11 min-w-11 items-center rounded-[8px] px-3 text-[length:var(--hg-text-callout)] font-semibold whitespace-nowrap",
              on ? "bg-surface text-fg shadow-[var(--hg-shadow-1)]" : "text-fg-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
