"use client";

import { ExternalLink, Lock, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mark } from "@/components/teire/mark";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { languageMarks } from "@/lib/marks";
import { cn } from "@/lib/utils";
import type { WelcomeData } from "@/lib/welcome";

type Repo = Extract<WelcomeData, { state: "ok" }>["repos"][number];

/** Rows drawn at once; "Show more" adds this many again, so an account of hundreds stays quick. */
const PAGE = 40;

/** The query's first match in a name, drawn bold: the reason a row is in the list. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-signal/15 font-semibold text-ink">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * The welcome page's repository step: search, a Picked filter and a list drawn a page at a time. The
 * order is fixed when the step opens (picked first, then by name), so a row never jumps while it's
 * switched; "/" focuses the search.
 */
export function RepoPicker({
  repos,
  chosen,
  onChange,
  needsAccess,
  manage,
}: {
  repos: Repo[];
  chosen: Set<string>;
  onChange: (next: Set<string>) => void;
  needsAccess: string[];
  manage: string;
}) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "picked">("all");
  const [limit, setLimit] = useState(PAGE);
  const search = useRef<HTMLInputElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the order is taken once per list, not per switch
  const ordered = useMemo(
    () =>
      [...repos].sort(
        (a, b) =>
          Number(chosen.has(b.fullName)) - Number(chosen.has(a.fullName)) ||
          a.fullName.localeCompare(b.fullName),
      ),
    [repos],
  );
  const q = query.trim().toLowerCase();
  const matches = ordered.filter(
    (r) => (show === "all" || chosen.has(r.fullName)) && (!q || r.fullName.toLowerCase().includes(q)),
  );
  const shown = matches.slice(0, limit);
  const allShownPicked = matches.length > 0 && matches.every((r) => chosen.has(r.fullName));
  const owners = new Set(repos.map((r) => r.fullName.split("/")[0]));

  // A new search or filter starts again at the first page.
  const find = (v: string) => {
    setQuery(v);
    setLimit(PAGE);
  };
  const filter = (v: "all" | "picked") => {
    setShow(v);
    setLimit(PAGE);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || t?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (name: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(name);
    else next.delete(name);
    onChange(next);
  };
  // "Pick all shown" acts on what the search and filter show, never on rows hidden by them.
  const pickShown = () => {
    const next = new Set(chosen);
    for (const r of matches) {
      if (allShownPicked) {
        if (r.status !== "active") next.delete(r.fullName);
      } else next.add(r.fullName);
    }
    onChange(next);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {repos.length > 1 ? (
        <>
          <InputGroup className="h-10 rounded-card bg-sunken">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              ref={search}
              value={query}
              onChange={(e) => find(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") find("");
              }}
              placeholder={`Search ${repos.length} repositories`}
              aria-label="Search repositories"
              autoComplete="off"
              spellCheck={false}
            />
            <InputGroupAddon align="inline-end">
              {query ? (
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => find("")}>
                  <X />
                </InputGroupButton>
              ) : (
                <kbd className="rounded border border-rule px-1.5 font-mono text-[10px] text-ink-3">/</kbd>
              )}
            </InputGroupAddon>
          </InputGroup>
          <div className="flex items-center justify-between gap-3 px-1">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={show}
              onValueChange={(v) => v && filter(v as "all" | "picked")}
              aria-label="Show"
            >
              <ToggleGroupItem value="all" className="px-2.5 font-mono text-[11px]">
                All {repos.length}
              </ToggleGroupItem>
              <ToggleGroupItem value="picked" className="px-2.5 font-mono text-[11px]">
                Picked {chosen.size}
              </ToggleGroupItem>
            </ToggleGroup>
            {matches.length ? (
              <button type="button" onClick={pickShown} className="text-xs text-ink-2 hover:text-ink">
                {allShownPicked ? "Unpick" : "Pick"}{" "}
                {q || show === "picked" ? `these ${matches.length}` : "all"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <ul className="-mx-1 flex max-h-[min(52vh,520px)] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {shown.map((r) => {
          const [owner, name = r.fullName] = r.fullName.split("/");
          const mark = languageMarks(r.languages)[0];
          const on = chosen.has(r.fullName);
          const id = `pick-${r.fullName}`;
          return (
            <li key={r.fullName}>
              <label
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-card px-3 py-2 transition-colors",
                  on ? "bg-signal/10 ring-1 ring-signal/30 ring-inset" : "bg-sunken hover:bg-sunken/70",
                )}
              >
                {mark ? <Mark brand={mark} size="sm" /> : null}
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  {owners.size > 1 ? <span className="text-ink-3">{owner}/</span> : null}
                  <Highlight text={name} query={q} />
                </span>
                {r.isPrivate ? <Lock className="size-3 shrink-0 text-ink-3" aria-label="private" /> : null}
                {r.status === "active" ? (
                  <span className="shrink-0 font-mono text-[11px] text-signal">on</span>
                ) : null}
                <Switch
                  id={id}
                  checked={on}
                  disabled={r.status === "active"}
                  onCheckedChange={(v) => toggle(r.fullName, v)}
                  aria-label={`Turn Teire on for ${r.fullName}`}
                />
              </label>
            </li>
          );
        })}
        {!matches.length ? (
          <li className="flex flex-col items-start gap-2 rounded-card border border-dashed border-rule px-3 py-4 text-[13px] text-ink-2">
            {q
              ? `No repository matches “${query.trim()}”.`
              : "Nothing picked yet. Search above and switch some on."}
            {q ? (
              <button type="button" onClick={() => find("")} className="text-xs text-link hover:underline">
                Clear the search
              </button>
            ) : null}
          </li>
        ) : null}
        {matches.length > shown.length ? (
          <li>
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="w-full rounded-card border border-dashed border-rule px-3 py-2 font-mono text-[12px] text-ink-2 hover:text-ink"
            >
              Show {Math.min(PAGE, matches.length - shown.length)} more · {matches.length - shown.length} left
            </button>
          </li>
        ) : null}
        {needsAccess.map((fullName) => (
          <li
            key={fullName}
            className="flex items-center justify-between gap-3 rounded-card border border-dashed border-rule px-3 py-2"
          >
            <span className="min-w-0 truncate font-mono text-[13px] text-ink-2">{fullName}</span>
            <span className="shrink-0 rounded-full bg-attention-soft px-2 py-0.5 font-mono text-[11px] text-attention">
              Needs GitHub access
            </span>
          </li>
        ))}
      </ul>
      <a
        href={manage}
        className="inline-flex w-fit items-center gap-1 px-1 text-[13px] text-link hover:underline"
      >
        Change repository access on GitHub <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
