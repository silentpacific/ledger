import Link from "next/link";
import type { StoreRow } from "@/lib/views";
import { dateAU, label, money } from "@/lib/format";
import { industryName } from "@/lib/industries";

/** The stores table used by the sites list, industry pages and list pages: one page of rows from web_site_list. */
export default function StoreTable({ rows, industry = true, bnplLabel = "Buy now, pay later", bnpl, loyalty = true, minWidth = 900 }: {
  rows: StoreRow[]; industry?: boolean; bnplLabel?: string; bnpl?: (r: StoreRow) => string; loyalty?: boolean; minWidth?: number;
}) {
  const none = <span className="muted">Not stated</span>;
  return (
    <div className="card scroll" style={{ padding: 0, marginTop: 12 }}>
      <table className="t" style={{ minWidth }}>
        <thead><tr><th style={{ paddingLeft: 20 }}>Store</th>{industry && <th>Industry</th>}<th>Platform</th><th style={{ textAlign: "right" }}>Free shipping over</th>
          <th style={{ textAlign: "right" }}>Returns</th><th>{bnplLabel}</th>{loyalty && <th>Loyalty</th>}{loyalty && <th>Last scan</th>}</tr></thead>
        <tbody>
          {rows.map((r) => {
            const b = bnpl ? bnpl(r) : r.bn.map(label).join(", ");
            return (
              <tr key={r.domain}>
                <td style={{ paddingLeft: 20 }}><Link href={`/sites/${r.domain}`} style={{ fontWeight: 600 }}>{r.name}</Link><div className="tiny muted">{r.domain}</div></td>
                {industry && <td className="muted">{industryName(r.industry)}</td>}
                <td>{r.p || "—"}</td>
                <td style={{ textAlign: "right" }}>{r.fs !== null ? money(r.fs) : none}</td>
                <td style={{ textAlign: "right" }}>{r.ret !== null ? `${r.ret} days` : none}</td>
                <td>{b || none}</td>
                {loyalty && <td>{r.lp ?? <span className="muted">—</span>}</td>}
                {loyalty && <td className="muted">{dateAU(r.last, { day: "numeric", month: "short" })}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Numbered pages for a stores table. `href(n)` builds the address of page n (filters kept). */
export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (n: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const near = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="row small" aria-label="Pages" style={{ gap: 6, marginTop: 14, alignItems: "center" }}>
      <span className="muted" style={{ marginRight: 8 }}>Showing {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
      {page > 1 && <Link scroll={false} className="chip" href={href(page - 1)} rel="prev">Previous</Link>}
      {near.map((n, i) => (
        <span key={n} className="row" style={{ gap: 6 }}>
          {i > 0 && n - near[i - 1] > 1 && <span className="muted">…</span>}
          <Link scroll={false} className={`chip${n === page ? " on" : ""}`} href={href(n)} aria-current={n === page ? "page" : undefined}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link scroll={false} className="chip" href={href(page + 1)} rel="next">Next</Link>}
    </nav>
  );
}
