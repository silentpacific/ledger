"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type Opt = { domain: string; name: string; industry: string };

/** Search box for the Compare page: type to filter, arrows to move, Enter to add, Backspace on an empty box removes the last site. */
export default function SitePicker({ options, chosen, max = 5 }: { options: Opt[]; chosen: string[]; max?: number }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const KEY = "ledger-picker-top";
  // After adding or removing a store the page re-renders and the content around the picker changes height.
  // Put the picker back at the same spot on screen it was at when the user acted, and keep typing in it.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    if (saved === null || !wrap.current) return;
    const delta = wrap.current.getBoundingClientRect().top - Number(saved);
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    input.current?.focus({ preventScroll: true });
  }, [chosen.join(",")]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const byDomain = useMemo(() => new Map(options.map((o) => [o.domain, o])), [options]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return options.filter((o) => !chosen.includes(o.domain) &&
      (!t || o.name.toLowerCase().includes(t) || o.domain.includes(t) || o.industry.toLowerCase().includes(t))).slice(0, 12);
  }, [q, options, chosen]);
  const go = (list: string[]) => {
    try { if (wrap.current) sessionStorage.setItem(KEY, String(wrap.current.getBoundingClientRect().top)); } catch { /* storage unavailable */ }
    router.push(list.length ? `/compare?sites=${list.join(",")}` : "/compare", { scroll: false });
  };
  const add = (d: string) => { setQ(""); setI(0); go([...chosen, d]); };
  const full = chosen.length >= max;

  return (
    <div ref={wrap} className="row" style={{ gap: 8, alignItems: "center", marginTop: 20 }}>
      {chosen.map((d) => (
        <span key={d} className="chip" style={{ fontWeight: 600, gap: 8 }}>
          {byDomain.get(d)?.name || d}
          <button type="button" aria-label={`Remove ${byDomain.get(d)?.name || d}`} onClick={() => go(chosen.filter((x) => x !== d))}
            style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
        </span>
      ))}
      {!full && (
        <div style={{ position: "relative", flex: "0 1 320px" }}>
          <label htmlFor={id} className="sr">Add a site to compare</label>
          <input ref={input} id={id} className="field" style={{ height: 38 }} autoComplete="off"
            placeholder={chosen.length ? "+ Add another site" : "Type a store name to start"}
            role="combobox" aria-expanded={open && matches.length > 0} aria-controls={`${id}-list`}
            aria-activedescendant={open && matches[i] ? `${id}-${i}` : undefined}
            value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => { setQ(e.target.value); setI(0); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setI((x) => Math.min(x + 1, matches.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (matches[i]) add(matches[i].domain); }
              else if (e.key === "Escape") setOpen(false);
              else if (e.key === "Backspace" && !q && chosen.length) go(chosen.slice(0, -1));
            }} />
          {open && matches.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="card"
              style={{ position: "absolute", zIndex: 20, top: 42, left: 0, right: 0, margin: 0, padding: 6, listStyle: "none", maxHeight: 360, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
              {matches.map((o, n) => (
                <li key={o.domain} id={`${id}-${n}`} role="option" aria-selected={n === i}
                  onMouseDown={(e) => { e.preventDefault(); add(o.domain); }} onMouseEnter={() => setI(n)}
                  style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", background: n === i ? "var(--accent-soft)" : undefined, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>{o.name}</span><span className="tiny muted">{o.industry}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <span className="tiny muted">{full ? `Maximum of ${max} sites` : `${chosen.length} of ${max}`}</span>
    </div>
  );
}
