import Link from "next/link";

export function Bars({ rows, max, color = "var(--accent)" }: { rows: { label: string; n: number; text?: string; href?: string; color?: string }[]; max?: number; color?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      {rows.map((r) => {
        const inner = (
          <>
            <span className="l">{r.label}</span>
            <span className="t"><span className="f" style={{ width: `${Math.max(1.5, (r.n / m) * 100)}%`, background: r.color || color }} /></span>
            <span className="n">{r.text ?? r.n}</span>
          </>
        );
        return r.href
          ? <Link key={r.label} href={r.href} className="bar" style={{ color: "inherit", textDecoration: "none" }}>{inner}</Link>
          : <div key={r.label} className="bar">{inner}</div>;
      })}
    </div>
  );
}

export function Stat({ k, v, sub, how }: { k: string; v: string | number; sub?: string; how?: string }) {
  return (
    <div className="card stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
      {how && (
        <details className="tiny muted" style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer" }}>How it's calculated</summary>
          <div style={{ marginTop: 4, lineHeight: 1.5 }}>{how}</div>
        </details>
      )}
    </div>
  );
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <div className="small muted">
      {items.map(([t, h], i) => (
        <span key={t}>{i > 0 && " / "}{h ? <Link href={h}>{t}</Link> : t}</span>
      ))}
    </div>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
