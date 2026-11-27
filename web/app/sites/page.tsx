import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import FilterSelect from "@/components/FilterSelect";
import { filterSites, getPromotions, getSites, promotionsFor, Site } from "@/lib/data";
import { KIND_NAMES, KIND_SINGULAR, facetHref, dateAU, facets, label, list, money, num, siteName, val } from "@/lib/format";
import { industryName } from "@/lib/industries";
import { BRAND } from "@/lib/brand";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Australian online stores we track",
  description: `Every Australian online store ${BRAND} tracks, filterable by industry, payment option, technology, platform and policy, with returns, shipping, buy now pay later and loyalty at a glance.`,
  alternates: { canonical: "/sites" },
};

const KINDS = ["payments", "tech", "platform", "policy"] as const;
type Q = { industry?: string; segment?: string; payments?: string; tech?: string; platform?: string; policy?: string };

export default async function Sites({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const [every, promosAll] = await Promise.all([getSites(), getPromotions()]);
  every.sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const scoped = filterSites(every, q.industry, q.segment);
  const fc = facets(scoped);
  const chosen = KINDS.map((k) => (q[k] ? fc[k].find((x) => x.value === q[k]) : undefined)).filter(Boolean) as any[];
  const sites = scoped.filter((s) => chosen.every((f) => f.test(s)));
  const promos = promotionsFor(promosAll, scoped);
  const link = (o: Record<string, string | undefined>) =>
    "/sites?" + new URLSearchParams(Object.entries({ ...q, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  // ready-made lists, worked out for whichever industry is selected
  const has = (s: Site, p: string) => list(s, "payments.bnpl_providers").includes(p);
  const n = (kind: string, v: string) => (fc[kind]?.find((x) => x.value === v) as any)?.n || 0;
  const bf = new Set(promos.filter((p) => p.live && /black friday|cyber/i.test(`${p.name} ${p.discount}`)).map((p) => p.domain));
  const ready = [
    { n: scoped.filter((s) => has(s, "afterpay") && has(s, "zip") && !has(s, "humm")).length, title: "Afterpay and Zip, but no Humm", href: "/payments/humm#prospects" },
    { n: n("payments", "klarna"), title: "Offer Klarna", href: link({ payments: "klarna" }) },
    { n: bf.size, title: "Running Black Friday or Cyber Monday", href: `/promotions${q.industry ? `?industry=${q.industry}` : ""}` },
    { n: n("policy", "30-day-returns"), title: "30-day returns or longer", href: link({ policy: "30-day-returns" }) },
    { n: n("policy", "free-shipping-under-80"), title: "Free shipping under $80", href: link({ policy: "free-shipping-under-80" }) },
    { n: n("policy", "loyalty-programme"), title: "Have a loyalty programme", href: link({ policy: "loyalty-programme" }) },
  ];

  return (
    <>
      <Header active="/sites" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Australian online stores we track", path: "/sites", crumbs: [["Stores"]], items: sites.map((s) => ({ name: siteName(s), path: `/sites/${s.domain}` })) })} />
      <main className="wrap page">
        <div className="eyebrow">Sites{q.industry ? ` · ${industryName(q.industry)}` : ""}</div>
        <h1 className="title">Stores we track</h1>
        <p className="lede">{every.length} Australian online stores across {new Set(every.map((s) => s.industry || "jewellery")).size} industries. Pick an industry, then narrow by payment option, tool, platform or policy. Open a store for its full profile, change history, promotions and prices.</p>

        <IndustryFilter path="/sites" sites={every} industry={q.industry} segment={q.segment}
          keep={{ payments: q.payments, tech: q.tech, platform: q.platform, policy: q.policy }}
          extra={<>
            {KINDS.map((k) => (
              <FilterSelect key={k} label={KIND_SINGULAR[k]} param={k} value={q[k]} path="/sites" query={{ ...q }} width={190}
                options={[{ value: "", label: "Any" }, ...fc[k].map((x: any) => ({ value: x.value, label: `${x.name} (${x.n})` }))]} />
            ))}
            {chosen.length > 0 && <Link scroll={false} className="small" href={link({ payments: undefined, tech: undefined, platform: undefined, policy: undefined })}>Clear filters</Link>}
          </>} />

        {chosen.length === 0 && (
          <div className="grid g3" style={{ marginTop: 16 }}>
            {ready.map((r) => (
              <Link scroll={false} key={r.title} href={r.href} className="card" style={{ color: "var(--ink)", textDecoration: "none", display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                <span className="display" style={{ fontSize: 26, fontWeight: 600, minWidth: 40 }}>{r.n}</span>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{sites.length} {sites.length === 1 ? "store" : "stores"}{chosen.length ? ` · ${chosen.map((f) => f.name).join(" · ")}` : ""}</h2>
          {chosen.length === 1 && <Link className="small" href={facetHref(chosen[0].kind, chosen[0].value)} style={{ fontWeight: 600 }}>Who added or dropped it →</Link>}
        </div>
        <div className="card scroll" style={{ padding: 0, marginTop: 12 }}>
          <table className="t" style={{ minWidth: 900 }}>
            <thead><tr><th style={{ paddingLeft: 20 }}>Store</th><th>Industry</th><th>Platform</th><th style={{ textAlign: "right" }}>Free shipping over</th><th style={{ textAlign: "right" }}>Returns</th><th>Buy now, pay later</th><th>Loyalty</th><th>Last scan</th></tr></thead>
            <tbody>
              {sites.map((s) => {
                const fs = num(s, "shipping.free_shipping_threshold"), rd = num(s, "policies.returns.period_days");
                const bn = list(s, "payments.bnpl_providers"), lp = val(s, "loyalty.program");
                return (
                  <tr key={s.domain}>
                    <td style={{ paddingLeft: 20 }}><Link href={`/sites/${s.domain}`} style={{ fontWeight: 600 }}>{siteName(s)}</Link><div className="tiny muted">{s.domain}</div></td>
                    <td className="muted">{industryName(s.industry)}{s.segment ? ` · ${s.segment}` : ""}</td>
                    <td>{val(s, "tech_stack.platform") || "—"}</td>
                    <td style={{ textAlign: "right" }}>{fs !== undefined ? money(fs) : <span className="muted">Not stated</span>}</td>
                    <td style={{ textAlign: "right" }}>{rd !== undefined ? `${rd} days` : <span className="muted">Not stated</span>}</td>
                    <td>{bn.length ? bn.map(label).join(", ") : <span className="muted">Not stated</span>}</td>
                    <td>{typeof lp === "string" ? lp : <span className="muted">—</span>}</td>
                    <td className="muted">{dateAU(s.last_scanned_at, { day: "numeric", month: "short" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>"Not stated" means the store doesn't publish it, not that it isn't offered. Every filtered list has its own address, so it can be shared and bookmarked. Know a store we should add? Use "Suggest a site" below.</p>
      </main>
    </>
  );
}
