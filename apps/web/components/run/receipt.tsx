import { backendName } from "@/lib/utils";

/**
 * The run receipt (design ledger, signature move #1): one dot-leader row per model and per sandbox
 * phase, closed by the total. Every number is from the run's own records (llm_calls, sandbox_execs).
 */
export interface ReceiptCall {
  model: string;
  purpose: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
  latencyMs: number | null;
  /** What Otari reports: the model the host ran, the host, and whether a fallback served it. */
  servedModel?: string | null;
  provider?: string | null;
  fallback?: boolean;
}
export interface ReceiptExec {
  phase: string;
  command: string;
  exitCode: number | null;
  durationMs: number | null;
  backend: string;
}

function Row({ left, right, tone }: { left: string; right: string; tone?: string }) {
  return (
    <p className="flex gap-2">
      <span className="shrink-0">{left}</span>
      <span aria-hidden className="min-w-4 flex-1 overflow-hidden whitespace-nowrap text-border">
        {".".repeat(200)}
      </span>
      <span className={`shrink-0 text-right ${tone ?? ""}`}>{right}</span>
    </p>
  );
}

export function Receipt({
  calls,
  execs,
  total,
}: {
  calls: ReceiptCall[];
  execs: ReceiptExec[];
  total: number;
}) {
  // One row per model and host that answered (Otari's `Otari-Model` and `Otari-Provider`), so a
  // fallback to another host shows as its own row.
  const byModel = new Map<
    string,
    { calls: number; in: number; out: number; cost: number; fallbacks: number }
  >();
  for (const c of calls) {
    const name = (c.servedModel ?? c.model).split("/").pop() ?? c.model;
    const key = c.provider ? `${name} · ${c.provider}` : name;
    const m = byModel.get(key) ?? { calls: 0, in: 0, out: 0, cost: 0, fallbacks: 0 };
    byModel.set(key, {
      calls: m.calls + 1,
      in: m.in + c.tokensIn,
      out: m.out + c.tokensOut,
      cost: m.cost + Number(c.costUsd),
      fallbacks: m.fallbacks + (c.fallback ? 1 : 0),
    });
  }
  const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
  return (
    <div className="mx-auto w-full max-w-xl rounded-lg bg-card p-5 font-mono text-xs leading-6 shadow-card">
      <p className="mb-2 text-center text-muted-foreground">RECEIPT</p>
      <p className="mb-1 text-muted-foreground">models · through Otari</p>
      {byModel.size ? (
        [...byModel].map(([model, m]) => (
          <Row
            key={model}
            left={`${model} ×${m.calls}${m.fallbacks ? ` · ${m.fallbacks} fallback` : ""}`}
            right={`${m.in.toLocaleString()} in · ${m.out.toLocaleString()} out · $${m.cost.toFixed(4)}`}
          />
        ))
      ) : (
        <Row left="no model call" right="deterministic fix · $0.0000" />
      )}
      <p className="mt-3 mb-1 text-muted-foreground">
        sandbox · {backendName(execs.find((e) => e.phase !== "resolve")?.backend)}
      </p>
      {execs.map((e, i) => (
        <Row
          // biome-ignore lint/suspicious/noArrayIndexKey: commands repeat across rounds; order is the identity
          key={i}
          left={
            e.command === "install"
              ? `${e.phase === "install_baseline" ? "baseline" : "after"} install`
              : `${e.phase} ${e.command.length > 28 ? `${e.command.slice(0, 28)}…` : e.command}`
          }
          right={`exit ${e.exitCode ?? "—"} · ${seconds(e.durationMs)}`}
          tone={e.exitCode === 0 ? "text-clear" : "text-affected"}
        />
      ))}
      <div className="mt-3 border-t border-dashed pt-2">
        <Row left="total" right={`$${total.toFixed(4)}`} />
      </div>
    </div>
  );
}
