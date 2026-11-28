"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { findStores, type StoreHit } from "@/lib/client";
import { industryName } from "@/lib/industries";

/** Type a store's name or address: matching stores appear as you type; Enter opens the highlighted one, else searches. */
export default function HeroLookup({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [hits, setHits] = useState<StoreHit[]>([]);
  const t = q.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  useEffect(() => {
    if (!t) { setHits([]); return; }
    const ac = new AbortController();
    const h = setTimeout(() => findStores(t, 6, ac.signal).then(setHits).catch(() => {}), 120);
    return () => { clearTimeout(h); ac.abort(); };
  }, [t]);
  const go = () => (hits[i] ? router.push(`/sites/${hits[i].domain}`) : t && router.push(`/search?q=${encodeURIComponent(q.trim())}`));
  return (
    <form className="h-look" role="search" onSubmit={(e) => { e.preventDefault(); go(); }}>
      <label htmlFor={id} className="sr">Store name or address</label>
      <input id={id} value={q} autoComplete="off" spellCheck={false} placeholder="Type a store's name or URL"
        role="combobox" aria-expanded={hits.length > 0} aria-controls={`${id}-l`} aria-activedescendant={hits[i] ? `${id}-${i}` : undefined}
        style={dark ? { border: 0 } : undefined}
        onChange={(e) => { setQ(e.target.value); setI(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
          else if (e.key === "Escape") setQ("");
        }} />
      <button type="submit" className={dark ? "h-btn y" : "h-btn"}>Look up a store</button>
      {hits.length > 0 && (
        <ul id={`${id}-l`} role="listbox">
          {hits.map((m, n) => (
            <li key={m.domain} id={`${id}-${n}`} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)}
              onMouseDown={(e) => { e.preventDefault(); router.push(`/sites/${m.domain}`); }}>
              <span style={{ color: "#0F172A" }}>{m.name}</span><span>{industryName(m.industry)}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
