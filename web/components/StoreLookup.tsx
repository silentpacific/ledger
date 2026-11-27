"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { findStores, rpcClient, type StoreHit } from "@/lib/client";
import type { Card } from "@/lib/views";
import { industryName } from "@/lib/industries";

export type Profile = Card;

/** The homepage hero: type a store, see its record. Matches and records are fetched as you type (never every store);
 * the highlighted match previews as soon as its record arrives; Enter opens it. */
export default function StoreLookup({ start, tryThese, children }: {
  start: Card | null; tryThese: Card[]; children: React.ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(start?.domain ?? "");
  const [matches, setMatches] = useState<StoreHit[]>([]);
  const [searched, setSearched] = useState("");
  const [cards, setCards] = useState<Record<string, Card>>(() =>
    Object.fromEntries([start, ...tryThese].filter((c): c is Card => !!c).map((c) => [c.domain, c])));
  const t = q.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  useEffect(() => { // matching stores, a moment after typing stops
    if (!t) { setMatches([]); setSearched(""); return; }
    const ac = new AbortController();
    const h = setTimeout(() => findStores(t, 7, ac.signal).then((m) => { setMatches(m); setSearched(t); }).catch(() => {}), 120);
    return () => { clearTimeout(h); ac.abort(); };
  }, [t]);
  const want = matches[i]?.domain ?? shown;
  useEffect(() => { // the record for the highlighted store
    if (!want || cards[want]) return;
    const ac = new AbortController();
    rpcClient<Card | null>("web_site_card", { p_domain: want }, ac.signal).then((c) => c && setCards((x) => ({ ...x, [want]: c }))).catch(() => {});
    return () => ac.abort();
  }, [want, cards]);
  const p = cards[want] ?? cards[shown] ?? start;
  const unknown = t.length > 2 && searched === t && !matches.length;
  const open = (d: string) => router.push(`/sites/${d}`);

  return (
    <section className="hero" aria-label="Look up a store">
      <div className="hero-text">
        {children}
        {tryThese.length > 0 && (
          <p className="hero-try">Try{" "}
            {tryThese.map((x) => (
              <button key={x.domain} type="button" onClick={() => { setQ(""); setShown(x.domain); input.current?.focus(); }}>{x.name}</button>
            ))}
          </p>
        )}
      </div>
    <div className="lookup">
      <div className="lookup-bar">
        <label htmlFor={id} className="sr">Look up a store</label>
        <span className="lookup-scheme" aria-hidden="true">store</span>
        <input ref={input} id={id} value={q} autoComplete="off" spellCheck={false}
          placeholder="Type a store, like Lovisa or koala.com"
          role="combobox" aria-expanded={matches.length > 0} aria-controls={`${id}-list`}
          aria-activedescendant={matches[i] ? `${id}-${i}` : undefined}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, matches.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
            else if (e.key === "Enter" && matches[i]) { e.preventDefault(); open(matches[i].domain); }
            else if (e.key === "Escape") { setQ(""); }
          }} />
        {matches.length > 0 && (
          <ul id={`${id}-list`} role="listbox" className="lookup-list">
            {matches.map((m, n) => (
              <li key={m.domain} id={`${id}-${n}`} role="option" aria-selected={n === i}
                onMouseEnter={() => setI(n)} onMouseDown={(e) => { e.preventDefault(); open(m.domain); }}>
                <span>{m.name}</span><span className="lookup-ind">{industryName(m.industry)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <article className="record" aria-live="polite">
        {!p ? null : unknown ? (
          <div className="record-empty">
            <h2>We don't track “{q.trim()}” yet</h2>
            <p>Check the spelling, or suggest the store using the form at the bottom of this page. We add stores whose terms allow it.</p>
          </div>
        ) : (
          <>
            <header className="record-head">
              <h2>{p.name}</h2>
              <p>{p.domain}<span className="record-sep" />{p.industry}<span className="record-sep" /><span className="live-dot" aria-hidden="true" />Checked {p.checked}</p>
            </header>
            <dl className="record-rows">
              {p.rows.map(([k, v]) => (
                <div key={k} className="record-row">
                  <dt>{k}</dt><dd className={v ? undefined : "record-none"}>{v ?? "Not published"}</dd>
                </div>
              ))}
            </dl>
            <footer className="record-foot">
              <Link href={`/sites/${p.domain}`} className="btn">Open full profile</Link>
              <Link href={`/compare?sites=${[p.domain, ...p.peers].join(",")}`} className="btn ghost">Compare with competitors</Link>
            </footer>
          </>
        )}
      </article>
    </div>
    </section>
  );
}
