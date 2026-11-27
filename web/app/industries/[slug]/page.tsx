import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { Bars, Crumbs, Stat } from "@/components/ui";
import { getView, listSites, PAGE_SIZE } from "@/lib/data";
import StoreTable, { Pager } from "@/components/StoreTable";
import { INDUSTRIES } from "@/lib/industries";
import { dateAU } from "@/lib/format";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => INDUSTRIES.map((i) => ({ slug: i.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const i = INDUSTRIES.find((x) => x.slug === slug);
  if (!i) return {};
  return {
    title: `${i.name}: Australian online stores compared`,
    description: `Returns, shipping, buy now pay later, loyalty and live promotions across Australian ${i.name.toLowerCase()} stores, dated and sourced.`,
    alternates: { canonical: `/industries/${slug}` },
  };
}

export default async function IndustryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const ind = INDUSTRIES.find((x) => x.slug === slug);
  if (!ind) notFound();
  type V = { n: number; latest: string; liveN: number; bestN: number; deals: { domain: string; store: string; name: string; discount: string | null }[];
    fs: string | null; fsN: number; ret: number | null; retN: number; bnplN: number; prov: { label: string; n: number }[] };
  const [v, list] = await Promise.all([getView<V>(`industry:${slug}`), listSites({ industry: slug, page })]);
  const n = v?.n ?? 0, latest = v?.latest ?? "";
  return (
    <>
      <Header active="/industries" />
      <JsonLd data={pageSchema({ type: "CollectionPage", name: ind.name, path: `/industries/${slug}`, crumbs: [["Industries", "/industries"], [ind.name]], items: list.rows.map((s) => ({ name: s.name, path: `/sites/${s.domain}` })) })} />
      <main className="wrap page">
        <Crumbs items={[["Industries", "/industries"], [ind.name]]} />
        <h1 className="title">{ind.name}</h1>
        <p className="lede">{ind.why} {n ? `${n} Australian stores tracked so far${latest ? `, last scanned ${dateAU(latest)}` : ""}.` : "The first stores are being scanned now; they'll appear here as soon as their scans finish."}</p>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <Link className="chip" href={`/?industry=${slug}`}>This week</Link>
          <Link className="chip" href={`/sites?industry=${slug}`}>Sites</Link>
          <Link className="chip" href={`/benchmarks?industry=${slug}`}>Benchmarks</Link>
          <Link className="chip" href={`/promotions?industry=${slug}`}>Promotions calendar</Link>
          <Link className="chip" href={`/tech?industry=${slug}`}>Tech</Link>
        </div>

        {v && n > 0 && <>
          <div className="grid g4" style={{ marginTop: 28 }}>
            <Stat k="Stores monitored" v={n} />
            <Stat k="Stores with an active offer" v={v.bestN} sub={`${v.liveN} offers running`} />
            <Stat k="Median free-shipping threshold" v={v.fs ?? "—"} sub={v.fsN ? `${v.fsN} sites state one` : "not stated yet"} />
            <Stat k="Median returns window" v={v.ret !== null ? `${v.ret} days` : "—"} sub={v.retN ? `${v.retN} sites state one` : "not stated yet"} />
          </div>

          <div className="grid g2" style={{ marginTop: 24 }}>
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Buy now, pay later</h2>
              {v.prov.length ? <Bars color="var(--blue)" max={v.bnplN} rows={v.prov.map((p) => ({ ...p, text: `${p.n} of ${v.bnplN}` }))} />
                : <p className="small muted">No BNPL options found yet.</p>}
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Biggest offers live now</h2>
              {v.deals.length ? v.deals.map((p) => (
                <div key={p.domain} className="kv"><Link href={`/sites/${p.domain}`} className="k" style={{ color: "var(--ink)", fontWeight: 600 }}>{p.store}</Link><span className="v" style={{ fontWeight: 400 }}>{p.name}{p.discount && !p.name.includes(p.discount) ? ` · ${p.discount}` : ""}</span></div>
              )) : <p className="small muted">No discounts seen yet.</p>}
            </section>
          </div>

          <h2 style={{ margin: "28px 0 0", fontSize: 22 }}>{n} {n === 1 ? "store" : "stores"}</h2>
          <StoreTable rows={list.rows} industry={false} />
          <Pager page={page} total={list.total} size={PAGE_SIZE} href={(p) => `/industries/${slug}${p > 1 ? `?page=${p}` : ""}`} />
          <p className="small muted" style={{ marginTop: 12 }}>"Not stated" means the store doesn't publish it, not that it isn't offered.</p>
        </>}
      </main>
    </>
  );
}
