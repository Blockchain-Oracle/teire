import { AllowanceMeter } from "@/components/app/allowance-meter";
import { Button } from "@/components/ui/button";
import { installationAllowance, meterOf, personAllowance, serviceAllowance } from "@/lib/allowances";
import { isOperator, operatorView } from "@/lib/operator";
import { moveAllowance, pauseAllowance } from "./allowance-actions";

const usd = (n: number | null) =>
  n === null ? "none" : n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
const PERIOD: Record<string, string> = {
  calendar_day: "a day",
  calendar_week: "a week",
  calendar_month: "a month",
};

/**
 * Allowances (S03): what Otari lets each one spend. Everyone sees their own and their installation's.
 * Teire's operator also sees the key's ceiling and every end user, and can move one to another of the
 * key's budgets (the demo walk's tiny and raised budgets) or pause it, all on Otari.
 */
export async function Allowances({
  userId,
  installation,
}: {
  userId: string;
  installation: { id: number; login: string } | null;
}) {
  const [you, theirs, operator] = await Promise.all([
    personAllowance(userId),
    installation ? installationAllowance(installation.id) : null,
    isOperator(userId),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-medium text-ink">Your AI allowances</h2>
          <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-[11px] text-ink-3">
            kept by Otari
          </span>
        </div>
        <div className="flex flex-col gap-4 rounded-xl bg-sheet p-4 shadow-card">
          <AllowanceMeter label="You: Ask Teire, public scans, dry runs" meter={meterOf(you)} />
          {installation ? (
            <AllowanceMeter
              label={`${installation.login}: scans, fix runs, CI repair`}
              meter={meterOf(theirs)}
            />
          ) : null}
          <p className="text-[12px] text-ink-3">
            Every model call Teire makes is billed on Otari to whoever it is for. When an allowance runs out,
            Otari refuses the next call; a run waits for its own reset and starts again by itself, and Ask
            Teire says when it comes back. Nobody else's work stops.
          </p>
        </div>
      </section>
      {operator ? <Operator /> : null}
    </div>
  );
}

async function Operator() {
  const [ceiling, view] = await Promise.all([serviceAllowance(), operatorView().catch(() => null)]);
  if (!view)
    return <p className="text-sm text-ink-3">Otari didn't answer for the key's end users; try again.</p>;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium text-ink">Every allowance</h2>
        <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-[11px] text-ink-3">
          operator
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-xl bg-sheet p-4 shadow-card">
          <span className="text-[13px] text-ink-2">Teire's ceiling on Otari</span>
          <span className="font-mono text-[1.75rem] leading-none font-medium text-ink tabular-nums">
            {usd(ceiling?.leftUsd ?? null)}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            left · {ceiling?.scope ?? "key"} · resets {ceiling?.resetsAt?.slice(0, 10) ?? "n/a"}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-sheet p-4 shadow-card sm:col-span-2">
          <span className="text-[13px] text-ink-2">The key's budgets</span>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] text-ink-2 sm:grid-cols-2">
            {view.budgets.map((b) => (
              <li key={b.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {b.name}
                  {b.isDefault ? <span className="text-ink-3"> (default)</span> : null}
                </span>
                <span className="shrink-0 text-ink-3">
                  {usd(b.maxUsd)} {b.period ? (PERIOD[b.period] ?? b.period) : ""} · {b.endUsers}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-sheet shadow-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              {["Who", "Budget", "Spent", "Resets", "Move to", ""].map((h) => (
                <th key={h || "pause"} scope="col" className="px-4 py-2 text-xs font-normal text-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {view.rows.map((r) => (
              <tr key={r.externalId} className={r.blocked ? "opacity-60" : undefined}>
                <td className="px-4 py-2">
                  <span className="flex flex-col">
                    <span className="text-ink">{r.who}</span>
                    <span className="font-mono text-[10px] text-ink-3">{r.externalId}</span>
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-ink-2">{r.budget ?? "?"}</td>
                <td className="px-4 py-2 font-mono text-xs text-ink tabular-nums">
                  {usd(r.spentUsd)}
                  <span className="text-ink-3"> / {usd(r.limitUsd)}</span>
                  {r.heldUsd ? (
                    <span className="block text-[10px] text-ink-3">{usd(r.heldUsd)} held</span>
                  ) : null}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-ink-3">
                  {r.resetsAt ? `${r.resetsAt.slice(5, 10)} ${r.resetsAt.slice(11, 16)}` : "next call"}
                </td>
                <td className="px-4 py-2">
                  <MoveForm endUser={r.externalId} budgets={view.budgets} current={r.budget} />
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={pauseAllowance}>
                    <input type="hidden" name="endUser" value={r.externalId} />
                    <input type="hidden" name="blocked" value={r.blocked ? "false" : "true"} />
                    <Button type="submit" size="sm" variant="outline">
                      {r.blocked ? "Resume" : "Pause"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {view.waiting.map((w) => (
              <tr key={w.externalId}>
                <td className="px-4 py-2">
                  <span className="flex flex-col">
                    <span className="text-ink">{w.who}</span>
                    <span className="font-mono text-[10px] text-ink-3">{w.externalId}</span>
                  </span>
                </td>
                <td colSpan={3} className="px-4 py-2 text-[11px] text-ink-3">
                  No call yet: Otari puts it on the default budget at its first call
                </td>
                <td className="px-4 py-2">
                  <MoveForm endUser={w.externalId} budgets={view.budgets} current={null} />
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MoveForm({
  endUser,
  budgets,
  current,
}: {
  endUser: string;
  budgets: { id: string; name: string }[];
  current: string | null;
}) {
  return (
    <form action={moveAllowance} className="flex items-center gap-2">
      <input type="hidden" name="endUser" value={endUser} />
      <select
        name="budget"
        defaultValue={budgets.find((b) => b.name === current)?.id ?? ""}
        aria-label={`Budget for ${endUser}`}
        className="h-8 max-w-44 rounded-md border border-rule bg-canvas px-2 font-mono text-[11px] text-ink"
      >
        <option value="" disabled>
          pick a budget
        </option>
        {budgets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Move
      </Button>
    </form>
  );
}
