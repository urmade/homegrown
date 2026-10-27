import pg from "pg";
import { currentContext } from "./context";

export type Level = "error" | "warn" | "info" | "debug";

export type LogLine = {
  time: string;
  level: Level;
  module: string | null;
  function: string | null;
  memberId: string | null;
  correlationId: string | null;
  sha: string | null;
  msg: string;
  data?: Record<string, unknown>;
};

export interface LogSink {
  write(batch: LogLine[]): Promise<void>;
}

// Redaction runs before any sink: secrets, credentials, request payloads and personal data never leave the process.
const REDACT =
  /pass|secret|token|key|auth|cookie|session|credential|content|body|payload|input|output|email|phone|address|name|title|note/i;
const KEEP = new Set(["stack", "table", "columns", "capability", "durationMs", "status", "route", "count", "sha", "error"]);

function redactSecretsInText(text: string): string {
  let out = text.replace(/postgres(?:ql)?:\/\/([^:/?#\s]+):([^@\s]+)@/gi, "postgres://$1:***@");
  out = out.replace(/x-access-token:[^@\s]+@/g, "x-access-token:***@");
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***");
  for (const key of ["POSTGRES_PASSWORD", "APP_DB_PASSWORD", "GITHUB_TOKEN", "DATABASE_URL", "MIGRATE_DATABASE_URL"]) {
    const v = process.env[key];
    if (v && v.length >= 4) out = out.split(v).join("***");
  }
  return out;
}

export function redact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!KEEP.has(k) && REDACT.test(k)) out[k] = "[redacted]";
    else if (typeof v === "string") {
      const s = redactSecretsInText(v);
      out[k] = s.length > 2000 ? `${s.slice(0, 2000)}…` : s;
    } else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = redact(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

export const stdoutSink: LogSink = {
  async write(batch) {
    for (const line of batch) process.stdout.write(`${JSON.stringify(line)}\n`);
  },
};

export function postgresSink(connectionString: string): LogSink {
  const pool = new pg.Pool({ connectionString, max: 2 });
  pool.on("error", () => {});
  return {
    async write(batch) {
      const cols = ["ts", "level", "module", "fn", "member_id", "correlation_id", "sha", "msg", "data"];
      const values: unknown[] = [];
      const rows = batch.map((l, i) => {
        values.push(l.time, l.level, l.module, l.function, l.memberId, l.correlationId, l.sha, l.msg, l.data ?? null);
        return `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(",")})`;
      });
      await pool.query(`insert into logs.logs (${cols.join(",")}) values ${rows.join(",")}`, values);
    },
  };
}

/** OTLP/HTTP JSON export (e.g. to an LGTM stack on the LAN); fields match every other sink. */
export function otelSink(endpoint: string): LogSink {
  const severity = { debug: 5, info: 9, warn: 13, error: 17 } as const;
  const attr = (key: string, v: unknown) => ({ key, value: { stringValue: String(v) } });
  return {
    async write(batch) {
      const logRecords = batch.map((l) => ({
        timeUnixNano: `${Date.parse(l.time)}000000`,
        severityNumber: severity[l.level],
        severityText: l.level,
        body: { stringValue: l.msg },
        attributes: Object.entries({ ...l, msg: undefined, time: undefined, level: undefined, data: JSON.stringify(l.data ?? {}) })
          .filter(([, v]) => v != null)
          .map(([k, v]) => attr(k, v)),
      }));
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/v1/logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceLogs: [{ resource: { attributes: [attr("service.name", "homegrown")] }, scopeLogs: [{ logRecords }] }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`otlp ${res.status}`);
    },
  };
}

/** HG_LOG_SINKS=postgres,otel (default postgres). Without a database, stdout. */
export function sinksFromEnv(env = process.env): LogSink[] {
  const names = (env.HG_LOG_SINKS ?? "postgres").split(",").map((s) => s.trim());
  const sinks: LogSink[] = [];
  if (names.includes("postgres") && env.DATABASE_URL) sinks.push(postgresSink(env.DATABASE_URL));
  if (names.includes("otel") && env.OTEL_EXPORTER_OTLP_ENDPOINT) sinks.push(otelSink(env.OTEL_EXPORTER_OTLP_ENDPOINT));
  if (names.includes("stdout") || sinks.length === 0) sinks.push(stdoutSink);
  return sinks;
}

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

class Batcher {
  private buf: LogLine[] = [];
  private timer: NodeJS.Timeout | undefined;
  constructor(private sinks: LogSink[]) {}
  push(line: LogLine) {
    this.buf.push(line);
    if (this.buf.length >= 100) void this.flush();
    else this.timer ??= setTimeout(() => void this.flush(), 1000).unref();
  }
  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const batch = this.buf.splice(0);
    if (batch.length === 0) return;
    await Promise.all(this.sinks.map((s) => s.write(batch).catch(() => (s === stdoutSink ? undefined : stdoutSink.write(batch)))));
  }
}

export type Logger = Record<Level, (msg: string, data?: Record<string, unknown>) => void>;

let batcher: Batcher | undefined;
const minLevel = (): Level => (process.env.HG_LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const flushLogs = () => batcher?.flush() ?? Promise.resolve();

function emit(level: Level, msg: string, data?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  batcher ??= new Batcher(sinksFromEnv());
  const ctx = currentContext();
  batcher.push({
    time: new Date().toISOString(),
    level,
    module: ctx?.module ?? null,
    function: ctx?.fn ?? null,
    memberId: ctx?.memberId ?? null,
    correlationId: ctx?.correlationId ?? null,
    sha: process.env.HG_SHA ?? null,
    msg,
    ...(data ? { data: redact(data) } : {}),
  });
}

export const log: Logger = {
  error: (m, d) => emit("error", m, d),
  warn: (m, d) => emit("warn", m, d),
  info: (m, d) => emit("info", m, d),
  debug: (m, d) => emit("debug", m, d),
};

export const errorData = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  return e instanceof Error
    ? { error: redactSecretsInText(raw).slice(0, 500), stack: e.stack ? redactSecretsInText(e.stack) : e.stack }
    : { error: redactSecretsInText(raw).slice(0, 500) };
};
