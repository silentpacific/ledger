import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites } from "@/lib/data";
import { KIND_NAMES, facets, list, maxPct, num, siteName } from "@/lib/format";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Explore Australian jewellery stores by payment option, tool and policy",
  description: "Find Australian online jewellery stores by the buy now pay later options, technologies, platforms and policies they use, and see who adopted or dropped each one.",
  alternates: { canonical: "/explore" },
};

export default async function Explore() {
  const [sites, promos] = await Promise.all([getSites(), getPromotions()]);
  const fc = facets(sites);
  const has = (s: any, p: string) => list(s, "payments.bnpl_providers").includes(p);
  const prospects = sites.filter((s) => has(s, "afterpay") && has(s, "zip") && !has(s, "humm"));
  const bfSites = new Set(promos.filter((p) => p.live && /black friday/i.test(`${p.name} ${p.discount}`)).map((p) => p.domain));
  const fs = sites.map((s) => [s, num(s, "shipping.free_shipping_threshold")] as const).filter(([, n]) => n !== undefined).sort((a, b) => a[1]! - b[1]!);
  const ready = [
    { n: fc.payments.find((x) => x.value === "humm") ? (fc.payments.find((x) => x.value === "humm") as any).n : 0, title: "Sites offering Humm", note: "Mostly chains and higher-ticket jewellers", href: "/explore/payments/humm" },
    { n: prospects.length, title: "Afterpay and Zip, but no Humm", note: prospects.slice(0, 4).map(siteName).join(", ") || "None right now", href: "/explore/payments/humm#prospects" },
    { n: bfSites.size, title: "Running Black Friday now", note: [...bfSites].slice(0, 4).map(siteName).join(", "), href: "/promotions" },
    { n: (fc.policy.find((x) => x.value === "30-day-returns") as any)?.n || 0, title: "30-day returns or longer", note: `Versus ${(fc.policy.find((x) => x.value === "14-day-returns") as any)?.n || 0} sites with 14 days or less`, href: "/explore/policy/30-day-returns" },
    { n: (fc.policy.find((x) => x.value === "free-shipping-under-80") as any)?.n || 0, title: "Free shipping under $80", note: fs.length ? `Lowest: ${siteName(fs[0][0])} at $${fs[0][1]}` : "", href: "/explore/policy/free-shipping-under-80" },
    { n: (fc.policy.find((x) => x.value === "loyalty-programme") as any)?.n || 0, title: "Have a loyalty programme", note: "From rewards clubs to VIP tiers", href: "/explore/policy/loyalty-programme" },
  ];
  return (
    <>
      <Header active="/explore" />
      <main className="wrap page">
        <div className="eyebrow">Explore · Jewellery</div>
        <h1 className="title">Find sites by what they use and do</h1>
        <p className="lede">Combine payment options, tools, platforms and policies to build a list of Australian stores, then see who adopted or dropped each one, and when.</p>

        <form action="/explore/filter" className="card" style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          {(["payments", "tech", "policy", "platform"] as const).map((k) => (
            <div key={k} style={{ flex: "1 1 200px" }}>
              <label className="lbl" htmlFor={`f-${k}`} style={{ fontWeight: 500, color: "var(--muted)", fontSize: 13 }}>{KIND_NAMES[k].replace(/s$/, "")}</label>
              <select id={`f-${k}`} name={k} className="field" defaultValue="">
                <option value="">Any</option>
                {fc[k].map((x: any) => <option key={x.value} value={x.value}>{x.name} ({x.n})</option>)}
              </select>
            </div>
          ))}
          <button className="btn" type="submit">Show sites</button>
        </form>

        <h2 style={{ margin: "40px 0 14px", fontSize: 24 }}>Ready-made lists</h2>
        <div className="grid g3">
          {ready.map((r) => (
            <Link key={r.title} href={r.href} className="card" style={{ color: "var(--ink)", textDecoration: "none" }}>
              <div className="display" style={{ fontSize: 32, fontWeight: 600 }}>{r.n}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{r.title}</div>
              <div className="small muted" style={{ marginTop: 4 }}>{r.note}</div>
            </Link>
          ))}
        </div>

        <h2 style={{ margin: "40px 0 14px", fontSize: 24 }}>Browse by</h2>
        <div className="grid g5">
          {Object.entries(fc).map(([k, items]) => (
            <section key={k} className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{KIND_NAMES[k]}</h3>
              <div className="tiny muted" style={{ margin: "2px 0 10px" }}>/explore/{k}</div>
              {items.slice(0, 12).map((x: any) => (
                <Link key={x.value} href={`/explore/${k}/${x.value}`} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid #F0EEE8", fontSize: 14, color: "var(--ink)" }}>
                  <span>{x.name}</span><span className="muted">{x.n}</span>
                </Link>
              ))}
            </section>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>Every list has its own address, so it can be shared and bookmarked.</p>
      </main>
    </>
  );
}
