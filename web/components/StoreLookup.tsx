"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";

export type Profile = {
  domain: string; name: string; industry: string; checked: string;
  rows: [string, string | null][]; peers: string[];
};

/** The homepage hero: type a store, see its record. The highlighted match previews instantly; Enter opens it. */
export default function StoreLookup({ profiles, start, tryThese, children }: {
  profiles: Profile[]; start: string; tryThese: { domain: string; name: string }[]; children: React.ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(start);
  const t = q.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const matches = useMemo(() => (t ? profiles.filter((p) => p.name.toLowerCase().includes(t) || p.domain.includes(t)).slice(0, 7) : []), [t, profiles]);
  const p = profiles.find((x) => x.domain === (matches[i]?.domain ?? shown)) ?? profiles[0];
  const unknown = t.length > 2 && !matches.length;
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
                <span>{m.name}</span><span className="lookup-ind">{m.industry}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <article className="record" aria-live="polite">
        {unknown ? (
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
