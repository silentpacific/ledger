import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPromotions, getSites, Site } from "@/lib/data";
import { Bars } from "@/components/ui";
import { isDiscount, list, maxPct, money, num, show, siteName, val } from "@/lib/format";

export const metadata: Metadata = {
  title: "Compare Australian jewellery stores side by side",
  description: "Compare returns, shipping, buy now pay later, loyalty and live promotions across Australian online jewellery stores.",
  alternates: { canonical: "/compare" },
};

const DEFAULT = ["zamels.com.au", "bevilles.com.au", "shiels.com.au", "mazzucchellis.com.au"];

type RowDef = { label: string; get: (s: Site) => string; score?: (s: Site) => number | undefined; better?: "low" | "high" };

export default async function Compare({ searchParams }: { searchParams: Promise<{ sites?: string; add?: string }> }) {
  const sp = await searchParams;
  const [all, promos] = await Promise.all([getSites(), getPromotions()]);
  let chosen = (sp.sites ? sp.sites.split(",") : DEFAULT).map((d) => d.trim()).filter(Boolean);
  if (sp.add) chosen.push(sp.add);
  chosen = [...new Set(chosen)].filter((d) => all.some((s) => s.domain === d)).slice(0, 5);
  const exists = (d: string) => all.some((s) => s.domain === d);
  const fill = [...DEFAULT.filter(exists), ...all.map((s) => s.domain)];
  if (chosen.length < 2) chosen = [...new Set([...chosen, ...fill])].slice(0, 4);
  const sites = chosen.map((d) => all.find((s) => s.domain === d)!);
  const headline = (s: Site) => {
    const p = promos.filter((x) => x.domain === s.domain && x.live && isDiscount(x)).sort((a, b) => maxPct(b) - maxPct(a))[0];
    return p ? `${p.name}${p.discount && !p.name.includes(p.discount) ? `: ${p.discount}` : ""}` : "None seen";
  };
  const groups: [string, RowDef[]][] = [
    ["The business", [
      { label: "Segment", get: (s) => s.segment || "—" },
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
    ["Promotions live now", [{ label: "Headline offer", get: headline }]],
  ];
  const best = (r: RowDef) => {
    if (!r.score) return undefined;
    const xs = sites.map(r.score).filter((x): x is number => x !== undefined);
    if (xs.length < 2) return undefined;
    return r.better === "low" ? Math.min(...xs) : Math.max(...xs);
  };
  const others = all.filter((s) => !chosen.includes(s.domain)).sort((a, b) => siteName(a).localeCompare(siteName(b)));
  const chartFs = sites.map((s) => ({ label: siteName(s), n: num(s, "shipping.free_shipping_threshold") ?? 0, text: num(s, "shipping.free_shipping_threshold") !== undefined ? money(num(s, "shipping.free_shipping_threshold"))! : "—" }));
  const chartRet = sites.map((s) => ({ label: siteName(s), n: num(s, "policies.returns.period_days") ?? 0, text: num(s, "policies.returns.period_days") !== undefined ? `${num(s, "policies.returns.period_days")} days` : "—" }));

  return (
    <>
      <Header active="/compare" />
      <main className="wrap page">
        <h1 className="title">Compare sites</h1>
        <p className="lede">Pick up to 5 sites. Values are the latest quality-checked facts; highlighted cells are the most customer-friendly in the group.</p>
        <div className="row" style={{ gap: 8, marginTop: 20, alignItems: "center" }}>
          {sites.map((s) => (
            <span key={s.domain} className="chip" style={{ fontWeight: 600, gap: 6 }}>
              {siteName(s)}
              {sites.length > 2 && <Link aria-label={`Remove ${siteName(s)}`} href={`/compare?sites=${chosen.filter((d) => d !== s.domain).join(",")}`} style={{ color: "var(--muted)", textDecoration: "none" }}>×</Link>}
            </span>
          ))}
          {sites.length < 5 && (
            <form action="/compare" style={{ display: "flex", gap: 6 }}>
              <input type="hidden" name="sites" value={chosen.join(",")} />
              <label htmlFor="add" className="sr">Add a site</label>
              <select id="add" name="add" className="field" style={{ height: 36, width: 200 }} defaultValue="">
                <option value="" disabled>+ Add site</option>
                {others.map((s) => <option key={s.domain} value={s.domain}>{siteName(s)}</option>)}
              </select>
              <button className="chip" type="submit" style={{ cursor: "pointer" }}>Add</button>
            </form>
          )}
        </div>

        <div className="card scroll" style={{ padding: 0, marginTop: 24 }}>
          <table className="t" style={{ minWidth: 860 }}>
            <thead><tr><th style={{ width: 200, paddingLeft: 20 }}></th>{sites.map((s) => <th key={s.domain} className="display" style={{ fontSize: 18, color: "var(--ink)" }}><Link href={`/sites/${s.domain}`} style={{ color: "var(--ink)" }}>{siteName(s)}</Link></th>)}</tr></thead>
            <tbody>
              {groups.map(([g, rows]) => [
                <tr key={g}><td colSpan={sites.length + 1} style={{ padding: "18px 20px 6px", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, borderTop: "1px solid var(--line)" }}>{g}</td></tr>,
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
      </main>
    </>
  );
}
