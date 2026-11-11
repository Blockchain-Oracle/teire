import type { MeterData } from "@/lib/allowances";

/** "00:00 UTC" for the next day, "Mon 16 Nov, 00:00 UTC" further out. */
function resetLabel(at: string | null): string | null {
  if (!at) return null;
  const d = new Date(at);
  const time = `${d.toISOString().slice(11, 16)} UTC`;
  if (d.getTime() - Date.now() < 24 * 3600_000) return time;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}, ${time}`;
}

const usd = (n: number) => (n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/**
 * One allowance on Otari as a bar: spent, then held by calls still running, against the budget's
 * limit, with what is left and when it resets. Shared by Settings › Usage and the Ask Teire card.
 */
export function AllowanceMeter({
  label,
  meter,
  compact = false,
}: {
  label: string;
  meter: MeterData | null;
  compact?: boolean;
}) {
  if (!meter)
    return (
      <div className="flex items-center gap-3 text-sm text-ink-3">
        <span className="text-ink-2">{label}</span>
        <span className="ml-auto text-xs">Otari didn't answer</span>
      </div>
    );
  const limit = meter.limitUsd ?? 0;
  const spent = limit ? Math.min(100, (meter.spentUsd / limit) * 100) : 0;
  const held = limit ? Math.min(100 - spent, (meter.heldUsd / limit) * 100) : 0;
  const reset = resetLabel(meter.resetsAt);
  const out = meter.blocked || (meter.leftUsd !== null && meter.leftUsd <= 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className={compact ? "text-[11px] text-ink-3" : "text-sm text-ink-2"}>{label}</span>
        {meter.budget && !compact ? (
          <span className="font-mono text-[10px] text-ink-3" title="The Otari budget this allowance is on">
            {meter.budget}
          </span>
        ) : null}
        <span className={`ml-auto font-mono tabular-nums ${compact ? "text-[11px]" : "text-xs"} text-ink`}>
          {usd(meter.spentUsd)}
          {meter.limitUsd !== null ? <span className="text-ink-3"> / {usd(meter.limitUsd)}</span> : null}
        </span>
      </div>
      {/* The figures above and below say the same in words; the bar is for the eye. */}
      <span
        className="flex h-1.5 overflow-hidden rounded-full bg-sunken ring-1 ring-rule ring-inset"
        aria-hidden
      >
        <span className={`block h-full ${out ? "bg-broke" : "bg-signal"}`} style={{ width: `${spent}%` }} />
        {held ? <span className="block h-full bg-signal/40" style={{ width: `${held}%` }} /> : null}
      </span>
      <span className="flex flex-wrap gap-x-3 font-mono text-[10px] text-ink-3">
        {meter.blocked ? (
          <span className="text-broke">paused by the operator</span>
        ) : meter.leftUsd !== null ? (
          <span className={out ? "text-broke" : undefined}>{usd(meter.leftUsd)} left</span>
        ) : (
          <span>no money limit</span>
        )}
        {meter.heldUsd > 0 ? <span>{usd(meter.heldUsd)} held by calls running now</span> : null}
        {reset ? <span>resets {reset}</span> : null}
      </span>
    </div>
  );
}
