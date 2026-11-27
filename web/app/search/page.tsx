import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites } from "@/lib/data";
import { KIND_NAMES, facetHref, dateAU, facets, siteName } from "@/lib/format";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const nq = norm(q);
  const words = nq.split(" ").filter(Boolean);
  const hit = (text: string) => words.length > 0 && words.every((w) => norm(text).includes(w));
  const [sites, promos] = await Promise.all([getSites(), getPromotions()]);
  const fc = facets(sites);
  const siteHits = words.length ? sites.filter((s) => hit(`${siteName(s)} ${s.domain} ${s.segment || ""}`)) : [];
  const facetHits = words.length ? Object.values(fc).flat().filter((f: any) => hit(f.name)) : [];
  const promoHits = words.length ? promos.filter((p) => hit(`${p.name} ${p.discount || ""} ${siteName(p.domain)}`))
    .sort((a, b) => Number(b.live) - Number(a.live) || (a.first_seen < b.first_seen ? 1 : -1)).slice(0, 40) : [];
  const total = siteHits.length + facetHits.length + promoHits.length;
  const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="small muted" style={{ margin: "32px 0 12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontFamily: "inherit" }}>{children}</h2>;

  return (
    <>
      <Header />
      <main className="narrow page">
        <form action="/search" role="search" style={{ display: "flex", gap: 8 }}>
          <label htmlFor="sq" className="sr">Search</label>
          <input id="sq" name="q" type="search" defaultValue={q} placeholder="Try afterpay, black friday, 30 day returns, klaviyo…" className="field" style={{ height: 52, fontSize: 18 }} />
          <button className="btn" style={{ height: 52 }}>Search</button>
        </form>
        {words.length > 0 && <p className="small muted" style={{ marginTop: 12 }}>{total} results for “{q}”</p>}

        {facetHits.length > 0 && <>
          <H id="lists">Lists &amp; pages</H>
          <div className="grid g2">
            {facetHits.map((f: any) => (
              <Link key={f.kind + f.value} href={facetHref(f.kind, f.value)} className="card" style={{ color: "var(--ink)", textDecoration: "none" }}>
                <div style={{ fontWeight: 600 }}>{f.name} · {f.n} {f.n === 1 ? "site" : "sites"}</div>
                <div className="small muted" style={{ marginTop: 4 }}>{KIND_NAMES[f.kind]}</div>
              </Link>
            ))}
          </div>
        </>}

        {siteHits.length > 0 && <>
          <H id="sites">Sites</H>
          <div className="grid g2">
            {siteHits.map((s) => (
              <Link key={s.domain} href={`/sites/${s.domain}`} className="card" style={{ color: "var(--ink)", textDecoration: "none" }}>
                <div style={{ fontWeight: 600 }}>{siteName(s)}</div><div className="small muted" style={{ marginTop: 4 }}>{s.domain} · {s.segment}</div>
              </Link>
            ))}
          </div>
        </>}

        {promoHits.length > 0 && <>
          <H id="promos">Promotions</H>
          <div className="card" style={{ padding: 0 }}>
            {promoHits.map((p, i) => (
              <Link key={i} href={`/sites/${p.domain}#promos`} className="feed-item" style={{ color: "var(--ink)", textDecoration: "none" }}>
                <span style={{ flex: "0 0 160px", fontWeight: 600 }}>{siteName(p.domain)}</span>
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>{p.name}{p.discount ? ` · ${p.discount}` : ""}</span>
                <span className="small muted" style={{ flex: "0 0 auto" }}>{p.live ? `Live · seen ${dateAU(p.last_seen, { day: "numeric", month: "short" })}` : p.starts ? `${dateAU(p.starts, { day: "numeric", month: "short", year: "numeric" })}${p.ends ? ` – ${dateAU(p.ends, { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "Ended"}</span>
              </Link>
            ))}
          </div>
        </>}

        {words.length > 0 && total === 0 && <div className="empty" style={{ marginTop: 24 }}>No results for “{q}”. Try a store name, a payment option like “zip”, or a promotion like “black friday”.</div>}
        <p className="small muted" style={{ marginTop: 28 }}>Search covers store names, payment options, technologies, platforms, policies and promotions.</p>
      </main>
    </>
  );
}
