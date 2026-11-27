"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { findStores, type StoreHit } from "@/lib/client";
import { industryName } from "@/lib/industries";

type Opt = { domain: string; name: string };

/** Search box for the Compare page: type to search (stores are looked up as you type, never all loaded), arrows to move,
 * Enter to add, Backspace on an empty box removes the last site. `chosen` are the stores already picked, with names. */
export default function SitePicker({ chosen: picked, max = 5 }: { chosen: Opt[]; max?: number }) {
  const chosen = picked.map((o) => o.domain);
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const KEY = "ledger-picker-top";
  const QKEY = "ledger-picker-q";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  // After adding or removing a store the page re-renders and the content around the picker changes height.
  // Put the picker back at the same spot on screen it was at when the user acted, and keep typing in it.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    let savedQ: string | null = null;
    try { savedQ = sessionStorage.getItem(QKEY); sessionStorage.removeItem(QKEY); } catch { /* storage unavailable */ }
    if (savedQ !== null) { setQ(savedQ); setOpen(true); }
    if (saved === null || !wrap.current) return;
    const delta = wrap.current.getBoundingClientRect().top - Number(saved);
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    input.current?.focus({ preventScroll: true });
    setOpen(true);
  }, [chosen.join(",")]);
  const byDomain = new Map(picked.map((o) => [o.domain, o]));
  const [found, setFound] = useState<StoreHit[]>([]);
  const t = q.trim();
  useEffect(() => { // matching stores, a moment after typing stops
    if (!t) { setFound([]); return; }
    const ac = new AbortController();
    const h = setTimeout(() => findStores(t, 12 + chosen.length, ac.signal).then(setFound).catch(() => {}), 120);
    return () => { clearTimeout(h); ac.abort(); };
  }, [t, chosen.join(",")]);
  const matches = found.filter((o) => !chosen.includes(o.domain)).slice(0, 12);
  const go = (list: string[]) => {
    try { if (wrap.current) sessionStorage.setItem(KEY, String(wrap.current.getBoundingClientRect().top)); } catch { /* storage unavailable */ }
    router.push(list.length ? `/compare?sites=${list.join(",")}` : "/compare", { scroll: false });
  };
  const add = (d: string) => {
    setQ(""); setI(0);
    if (input.current) input.current.value = "";
    go([...chosen, d]);
  };
  // the store to add on Enter: the highlighted one, else an exact name match, else the first match
  const pick = () => matches[i] || matches.find((o) => o.name.toLowerCase() === q.trim().toLowerCase()) || matches[0];
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
              else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                // text typed before the page finished loading isn't in state yet: read it from the box
                const typed = e.currentTarget.value;
                if (typed !== q || (t && !matches.length)) { setQ(typed);
                  findStores(typed, 6).then((xs) => { const m = xs.find((o) => !chosen.includes(o.domain)); if (m) add(m.domain); }).catch(() => {});
                  return; }
                const o = pick(); if (o) add(o.domain);
              }
              else if (e.key === "Escape") setOpen(false);
              else if (e.key === "Backspace" && !q && chosen.length) go(chosen.slice(0, -1));
            }} />
          {open && matches.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="picker-list">
              {matches.map((o, n) => (
                <li key={o.domain} id={`${id}-${n}`} role="option" aria-selected={n === i}
                  onMouseDown={(e) => { e.preventDefault(); add(o.domain); }} onMouseEnter={() => setI(n)}
                  className="picker-opt">
                  <span className="picker-name">{o.name}</span><span className="picker-ind">{industryName(o.industry)}</span>
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
