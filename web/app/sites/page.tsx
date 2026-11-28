import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import IndustryFilter from "@/components/IndustryFilter";
import FilterSelect from "@/components/FilterSelect";
import { getCounts, getView, listSitesSorted, PAGE_SIZE } from "@/lib/data";
import StoreTable, { Pager } from "@/components/StoreTable";
import { KIND_SINGULAR, facetHref } from "@/lib/format";
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
type Q = { industry?: string; segment?: string; payments?: string; tech?: string; platform?: string; policy?: string; page?: string; sort?: string; dir?: string };
type Opt = { value: string; name: string; n: number };

export default async function Sites({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1);
  const [fv, counts] = await Promise.all([getView<Record<string, any>>(`filters:${q.industry || "all"}`), getCounts()]);
  const fc: Record<string, Opt[]> = Object.fromEntries(KINDS.map((k) => [k, (fv?.[k] as Opt[]) || []]));
  const chosen = KINDS.map((k) => { const x = q[k] ? fc[k].find((o) => o.value === q[k]) : undefined; return x && { kind: k, ...x }; }).filter(Boolean) as (Opt & { kind: string })[];
  const list = await listSitesSorted({ industry: q.industry, tags: chosen.map((f) => `${f.kind}:${f.value}`), page, sort: q.sort, dir: q.dir });
  const link = (o: Record<string, string | undefined>) =>
    "/sites?" + new URLSearchParams(Object.entries({ ...q, page: undefined, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  // ready-made lists, worked out for whichever industry is selected
  const n = (kind: string, v: string) => fc[kind]?.find((x) => x.value === v)?.n || 0;
  const ready = [
    { n: fv?.azNoHumm ?? 0, title: "Afterpay and Zip, but no Humm", href: "/payments/humm#prospects" },
    { n: n("payments", "klarna"), title: "Offer Klarna", href: link({ payments: "klarna" }) },
    { n: fv?.bf ?? 0, title: "Running Black Friday or Cyber Monday", href: `/promotions${q.industry ? `?industry=${q.industry}` : ""}` },
    { n: n("policy", "30-day-returns"), title: "30-day returns or longer", href: link({ policy: "30-day-returns" }) },
    { n: n("policy", "free-shipping-under-80"), title: "Free shipping under $80", href: link({ policy: "free-shipping-under-80" }) },
    { n: n("policy", "loyalty-programme"), title: "Have a loyalty programme", href: link({ policy: "loyalty-programme" }) },
  ];
  const sites = { length: list.total };
  return (
    <>
      <Header active="/sites" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: "Australian online stores we track", path: "/sites", crumbs: [["Stores"]], items: list.rows.map((s) => ({ name: s.name, path: `/sites/${s.domain}` })) })} />
      <main className="wrap page">
        <div className="eyebrow">Sites{q.industry ? ` · ${industryName(q.industry)}` : ""}</div>
        <h1 className="title">Stores we track</h1>
        <p className="lede">{counts.all} Australian online stores across {counts.industries} industries. Pick an industry, then narrow by payment option, tool, platform or policy. Open a store for its full profile, change history, promotions and prices.</p>

        <IndustryFilter path="/sites" counts={counts} industry={q.industry}
          keep={{ payments: q.payments, tech: q.tech, platform: q.platform, policy: q.policy }}
          extra={<>
            {KINDS.map((k) => (
              <FilterSelect key={k} label={KIND_SINGULAR[k]} param={k} value={q[k]} path="/sites" query={{ ...q, page: undefined }} width={190}
                options={[{ value: "", label: "Any" }, ...fc[k].map((x) => ({ value: x.value, label: `${x.name} (${x.n})` }))]} />
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
        <StoreTable rows={list.rows} sort={{ key: q.sort, dir: q.dir, href: (k, d) => link({ sort: k, dir: d }) }} />
        <Pager page={page} total={list.total} size={PAGE_SIZE} href={(p) => link({ page: p > 1 ? String(p) : undefined })} />
        <p className="small muted" style={{ marginTop: 12 }}>"Not stated" means the store doesn't publish it, not that it isn't offered. Every filtered list has its own address, so it can be shared and bookmarked. Know a store we should add? Use "Suggest a site" below.</p>
      </main>
    </>
  );
}
