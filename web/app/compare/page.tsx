import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites, Site } from "@/lib/data";
import { Bars } from "@/components/ui";
import SitePicker from "@/components/SitePicker";
import { INDUSTRIES, industryName } from "@/lib/industries";
import { isDiscount, list, maxPct, money, num, show, siteName, val } from "@/lib/format";

export const metadata: Metadata = {
  title: "Compare Australian online stores side by side",
  description: "Compare returns, shipping, buy now pay later, loyalty and live promotions across Australian online stores, in any industry.",
  alternates: { canonical: "/compare" },
};

type RowDef = { label: string; get: (s: Site) => string; score?: (s: Site) => number | undefined; better?: "low" | "high" };

export default async function Compare({ searchParams }: { searchParams: Promise<{ sites?: string; add?: string }> }) {
  const sp = await searchParams;
  const [all, promos] = await Promise.all([getSites(), getPromotions()]);
  let chosen = (sp.sites ? sp.sites.split(",") : []).map((d) => d.trim()).filter(Boolean);
  if (sp.add) chosen.push(sp.add);
  chosen = [...new Set(chosen)].filter((d) => all.some((s) => s.domain === d)).slice(0, 5);
  const sites = chosen.map((d) => all.find((s) => s.domain === d)!);
  const headline = (s: Site) => {
    const p = promos.filter((x) => x.domain === s.domain && x.live && isDiscount(x)).sort((a, b) => maxPct(b) - maxPct(a))[0];
    return p ? `${p.name}${p.discount && !p.name.includes(p.discount) ? `: ${p.discount}` : ""}` : "None seen";
  };
  const groups: [string, RowDef[]][] = [
    ["The business", [
      { label: "Industry", get: (s) => `${industryName(s.industry)}${s.segment ? ` · ${s.segment}` : ""}` },
      { label: "Stores", get: (s) => show(s, "site_identity.store_count") },
      { label: "Platform", get: (s) => show(s, "tech_stack.platform") }]],
    ["Shipping", [
      { label: "Free shipping over", get: (s) => (num(s, "shipping.free_shipping_threshold") !== undefined ? money(num(s, "shipping.free_shipping_threshold"))! : "Not stated"), score: (s) => num(s, "shipping.free_shipping_threshold"), better: "low" },
      { label: "Standard delivery", get: (s) => show(s, "shipping.standard_shipping_cost", (v) => money(v) ?? String(v)), score: (s) => num(s, "shipping.standard_shipping_cost"), better: "low" },
      { label: "Express", get: (s) => show(s, "shipping.express_available") },
      { label: "Click and collect", get: (s) => show(s, "shipping.click_and_collect") }]],
    ["Returns", [
      { label: "Returns window", get: (s) => (num(s, "policies.returns.period_days") !== undefined ? `${num(s, "policies.returns.period_days")} days` : "Not stated"), score: (s) => num(s, "policies.returns.period_days"), better: "high" },
      { label: "Change of mind", get: (s) => show(s, "policies.returns.change_of_mind") },
      { label: "Free returns", get: (s) => show(s, "policies.returns.free_returns") }]],
    ["Payments", [
      { label: "Buy now, pay later", get: (s) => show(s, "payments.bnpl_providers"), score: (s) => list(s, "payments.bnpl_providers").length || undefined, better: "high" }]],
    ["Loyalty", [
      { label: "Programme", get: (s) => show(s, "loyalty.program") },
      { label: "Welcome offer", get: (s) => show(s, "loyalty.welcome_offer") },
      { label: "Birthday", get: (s) => show(s, "loyalty.birthday_reward") }]],
    ["Promotions", [
      { label: "Headline offer now", get: headline },
      { label: "Discounts seen since tracking began", get: (s) => String(promos.filter((x) => x.domain === s.domain && isDiscount(x)).length),
        score: (s) => promos.filter((x) => x.domain === s.domain && isDiscount(x)).length },
      { label: "Deepest discount seen", get: (s) => { const m = Math.max(0, ...promos.filter((x) => x.domain === s.domain).map(maxPct)); return m ? `Up to ${m}%` : "—"; } }]],
  ];
  const best = (r: RowDef) => {
    if (!r.score) return undefined;
    const xs = sites.map(r.score).filter((x): x is number => x !== undefined);
    if (xs.length < 2) return undefined;
    return r.better === "low" ? Math.min(...xs) : Math.max(...xs);
  };
  const suggestions = INDUSTRIES.map((i) => ({ name: i.name, sites: [...all.filter((x) => (x.industry || "jewellery") === i.slug && x.domain !== "curasept.com.au")]
      .sort((a, b) => Object.keys(b.facts).length - Object.keys(a.facts).length).slice(0, 3) })).filter((g) => g.sites.length >= 2);
  const options = [...all].sort((a, b) => siteName(a).localeCompare(siteName(b)))
    .map((s) => ({ domain: s.domain, name: siteName(s), industry: industryName(s.industry) }));
  const chartFs = sites.map((s) => ({ label: siteName(s), n: num(s, "shipping.free_shipping_threshold") ?? 0, text: num(s, "shipping.free_shipping_threshold") !== undefined ? money(num(s, "shipping.free_shipping_threshold"))! : "—" }));
  const chartRet = sites.map((s) => ({ label: siteName(s), n: num(s, "policies.returns.period_days") ?? 0, text: num(s, "policies.returns.period_days") !== undefined ? `${num(s, "policies.returns.period_days")} days` : "—" }));

  return (
    <>
      <Header active="/compare" />
      <main className="wrap page">
        <div className="eyebrow">Analyse</div>
        <h1 className="title">Compare stores side by side</h1>
        <p className="lede">See how competitors differ on shipping, returns, buy now pay later, loyalty and promotions. Pick up to 5 stores from any industry. Values are the latest quality-checked facts; highlighted cells are the most customer-friendly in the group.</p>
        <SitePicker options={options} chosen={chosen} />

        {sites.length === 0 && (
          <div className="grid g2" style={{ marginTop: 24 }}>
            <section className="card">
              <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Questions a comparison answers</h2>
              {["Which competitor has the lowest free-shipping minimum?", "Who offers Afterpay, Zip or Klarna, and who doesn't?",
                "Whose returns window is longest, and is change of mind accepted?", "Who discounts most often, and how deep?",
                "Who has a loyalty programme, and what does joining get you?"].map((x) => <div key={x} className="kv"><span>{x}</span></div>)}
              <p className="tiny muted" style={{ margin: "10px 0 0" }}>Start typing a store's name above and press Enter to add it. The page address can be shared.</p>
            </section>
            <section className="card">
              <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Or start with one of these</h2>
              {suggestions.map((g) => (
                <div key={g.name} className="kv">
                  <span><strong>{g.name}</strong> <span className="muted">· {g.sites.map((x) => siteName(x)).join(", ")}</span></span>
                  <Link href={`/compare?sites=${g.sites.map((x) => x.domain).join(",")}`} className="small" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Compare →</Link>
                </div>
              ))}
            </section>
          </div>
        )}
        {sites.length > 0 && <>
        <div className="card scroll" style={{ padding: 0, marginTop: 24 }}>
          <table className="t cmp" style={{ minWidth: 200 + sites.length * 180 }}>
            <colgroup><col style={{ width: 200 }} />{sites.map((s) => <col key={s.domain} />)}</colgroup>
            <thead><tr><th style={{ paddingLeft: 20 }}></th>{sites.map((s) => <th key={s.domain} className="display" style={{ fontSize: 18, color: "var(--ink)" }}><Link href={`/sites/${s.domain}`} style={{ color: "var(--ink)" }}>{siteName(s)}</Link></th>)}</tr></thead>
            <tbody>
              {groups.map(([g, rows]) => [
                <tr key={g}><td colSpan={sites.length + 1} style={{ padding: "18px 20px 6px", fontSize: 14, fontWeight: 600, color: "var(--ink)", borderTop: "1px solid var(--line)" }}>{g}</td></tr>,
                ...rows.map((r) => {
                  const b = best(r);
                  return (
                    <tr key={g + r.label}>
                      <td className="muted" style={{ paddingLeft: 20 }}>{r.label}</td>
                      {sites.map((s) => {
                        const v = r.get(s), isBest = b !== undefined && r.score!(s) === b;
                        return <td key={s.domain} style={{ background: isBest ? "var(--accent-soft)" : undefined, fontWeight: isBest ? 600 : 400, color: v === "Not stated" ? "var(--muted)" : undefined }}>{v}</td>;
                      })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>

        <div className="grid g2" style={{ marginTop: 24 }}>
          <section className="card"><h2 style={{ marginBottom: 14 }}>Free-shipping threshold</h2><Bars rows={chartFs} /></section>
          <section className="card"><h2 style={{ marginBottom: 14 }}>Returns window</h2><Bars rows={chartRet} color="var(--blue)" /></section>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>"Not stated" = not published on the site. Share this comparison by copying the page address.</p>
        </>}
      </main>
    </>
  );
}
