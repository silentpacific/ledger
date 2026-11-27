import type { Change, Fact, Promo, Site } from "./data";

// ---------- names ----------
const NAMES: Record<string, string> = {
  "zamels.com.au": "Zamel's", "mazzucchellis.com.au": "Mazzucchelli's", "lovisa.com.au": "Lovisa", "shiels.com.au": "Shiels",
  "bevilles.com.au": "Bevilles", "hardybrothers.com.au": "Hardy Brothers", "goldmark.com.au": "Goldmark", "prouds.com.au": "Prouds",
  "armsofeve.com": "Arms of Eve", "ambersceats.com": "Amber Sceats", "bianc.com.au": "Bianc", "brieleon.com": "Brie Leon",
  "calleija.com": "Calleija", "cerrone.com.au": "Cerrone", "christienicolaides.com.au": "Christie Nicolaides",
  "colettehayman.com.au": "Colette Hayman", "cushlawhiting.com.au": "Cushla Whiting", "dinosaurdesigns.com.au": "Dinosaur Designs",
  "fandhstudios.com": "F+H Studios", "kailisjewellery.com.au": "Kailis", "kirstinash.com": "Kirstin Ash",
  "larsenjewellery.com.au": "Larsen Jewellery", "lindatahija.com.au": "Linda Tahija", "lucyfolk.com": "Lucy Folk",
  "mountainandmoon.com": "Mountain and Moon", "najo.com.au": "Najo", "natashaschweitzer.com": "Natasha Schweitzer",
  "pastiche.com.au": "Pastiche", "reliquiacollective.com": "Reliquia", "sarahandsebastian.com": "Sarah & Sebastian",
  "shjewellery.com.au": "SH Jewellery", "templeandgrace.com.au": "Temple & Grace", "wanderlustandco.com": "Wanderlust + Co",
};
const KNOWN = new Map<string, string>(); // domain -> display name, filled by rememberNames() when sites load
const alnum = (x: string) => String(x ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

/** The store's own name: our list, then its schema.org / og:site_name name, then the part of its page title
 * that matches the domain ("Coco & Eve | Official Store" for cocoandeve.com), then the domain itself. */
export function displayName(s: Site): string {
  if (NAMES[s.domain]) return NAMES[s.domain];
  const base = s.domain.split(".")[0];
  const t = s.facts["site_identity.trading_name"]?.v;
  if (typeof t === "string" && t.length < 40 && t.trim()) return t.trim();
  const title = s.facts["content_marketing.homepage_title"]?.v;
  if (typeof title === "string") {
    const seg = title.split(/\s[|–—:\-]\s|\s?\|\s?/).map((x) => x.trim()).filter((x) => x && x.length <= 40)
      .find((x) => { const a = alnum(x), b = alnum(base); return a.length > 2 && (a === b || b.startsWith(a) || a.startsWith(b)); });
    if (seg) return seg;
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}
export function rememberNames(sites: Site[]) { sites.forEach((s) => KNOWN.set(s.domain, displayName(s))); }
export function siteName(s: Site | string): string {
  if (typeof s !== "string") return displayName(s);
  return KNOWN.get(s) ?? NAMES[s] ?? (s.split(".")[0].charAt(0).toUpperCase() + s.split(".")[0].slice(1));
}

// ---------- values ----------
const LABELS: Record<string, string> = {
  afterpay: "Afterpay", zip: "Zip", humm: "Humm", klarna: "Klarna", latitude: "Latitude", paypal_pay_in_4: "PayPal Pay in 4",
  openpay: "Openpay", apple_pay: "Apple Pay", google_pay: "Google Pay", shop_pay: "Shop Pay", paypal: "PayPal", amex: "Amex",
  mastercard: "Mastercard", visa: "Visa", unionpay: "UnionPay", diners: "Diners", wechat_pay: "WeChat Pay",
  contact_form: "Contact form", live_chat: "Live chat", email: "Email", phone: "Phone", chat: "Chat", sms: "SMS", whatsapp: "WhatsApp",
  original_payment: "Original payment method", store_credit: "Store credit", gift_card: "Gift card", exchange: "Exchange",
  delivery_date: "Delivery date", purchase_date: "Purchase date", dispatch_date: "Dispatch date",
  online_only: "Online orders only", conditional: "With conditions", yes: "Yes", no: "No", in_store_only: "In-store only",
  customer: "Customer", retailer: "The store", store: "The store", free: "Free",
  auspost: "Australia Post", australia_post: "Australia Post", startrack: "StarTrack", dhl: "DHL", couriers_please: "CouriersPlease",
};
export const label = (v: string) => { v = String(v ?? ""); return LABELS[v] ?? LABELS[v.toLowerCase()] ?? (v.charAt(0).toUpperCase() + v.slice(1)).replace(/_/g, " "); };
export const money = (v: any) => {
  const a = v && typeof v === "object" ? v.amount : v;
  if (typeof a !== "number") return null;
  return a === 0 ? "Free" : `$${Number.isInteger(a) ? a : a.toFixed(2)}`;
};
export function fmt(v: any): string {
  if (v === null || v === undefined) return "Not stated";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length < 40 && /^[a-z_]+$/.test(v) ? label(v) : v.charAt(0).toUpperCase() + v.slice(1);
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "string" ? label(x) : fmt(x))).join(", ") : "None";
  if (typeof v === "object") {
    if ("amount" in v) return money(v) ?? "Not stated";
    if ("protocol" in v) return `Yes (${v.protocol})`;
    if (Array.isArray((v as any).plans)) return `${(v as any).plans.join(" and ")} plans`;
    if ("provider" in v) return `${label(v.provider)}${v.weeks ? `, ${v.weeks} weeks` : ""}${v.months ? `, ${v.months} months` : ""}`;
    return Object.values(v).filter((x) => typeof x === "string" || typeof x === "number").join(", ") || "Yes";
  }
  return String(v);
}

/** A fact the site shows: observed or plainly not offered. Everything else reads "Not stated". */
export function fact(s: Site, key: string): Fact | undefined {
  const f = s.facts[key];
  return f && (f.s === "observed" || f.s === "not_offered") ? f : undefined;
}
export function val(s: Site, key: string): any {
  const f = fact(s, key);
  if (!f) return undefined;
  return f.s === "not_offered" ? false : f.v;
}
export function show(s: Site, key: string, as?: (v: any) => string): string {
  const f = fact(s, key);
  if (!f) return "Not stated";
  if (f.s === "not_offered") return "Not offered";
  return as ? as(f.v) : fmt(f.v);
}
export const num = (s: Site, key: string): number | undefined => {
  const v = val(s, key);
  const a = v && typeof v === "object" ? v.amount : v;
  return typeof a === "number" ? a : undefined;
};
export const list = (s: Site, key: string): string[] => {
  const v = val(s, key);
  // empty entries (null, "") are dropped: one bad list item must never break a page or the build
  return Array.isArray(v) ? v.filter((x) => x != null && String(x).trim()).map((x) => String(x).toLowerCase()) : [];
};

// ---------- profile cards ----------
type Row = [string, string, ((v: any) => string)?];
export const CARDS: { id: string; title: string; rows: Row[] }[] = [
  { id: "returns", title: "Returns", rows: [
    ["policies.returns.period_days", "Window", (v) => `${v} days`], ["policies.returns.period_starts", "Counted from"],
    ["policies.returns.change_of_mind", "Change of mind"], ["policies.returns.free_returns", "Free returns"],
    ["policies.returns.in_store_returns", "In-store returns"], ["policies.returns.return_shipping_payer", "Return postage paid by"],
    ["policies.returns.refund_methods", "Refund as"], ["policies.returns.exclusions", "Not returnable"],
    ["policies.returns.acl_mentioned", "Mentions consumer law"], ["policies.returns.free_exchanges", "Free exchanges"],
    ["policies.returns.opened_products", "Opened products"], ["policies.returns.opened_items", "Opened items"],
    ["policies.returns.large_items", "Large items"], ["policies.returns.used_items", "Used or worn gear"]] },
  { id: "shipping", title: "Shipping", rows: [
    ["shipping.free_shipping_threshold", "Free shipping", (v) => (money(v) === "Free" ? "On all orders" : `Orders over ${money(v)}`)],
    ["shipping.standard_shipping_cost", "Standard delivery", (v) => money(v) ?? fmt(v)], ["shipping.express_available", "Express"],
    ["shipping.express_cost", "Express fee", (v) => money(v) ?? fmt(v)], ["shipping.same_day_available", "Same day"],
    ["shipping.click_and_collect", "Click and collect"], ["shipping.dispatch_time", "Dispatch"],
    ["shipping.delivery_estimate", "Delivery time"], ["shipping.international_shipping", "International"],
    ["shipping.carriers", "Carriers"], ["shipping.signature_required", "Signature on delivery"],
    ["shipping.bulky_delivery_fee", "Bulky items"], ["shipping.assembly_service", "Assembly & installation"]] },
  { id: "payments", title: "Payments", rows: [
    ["payments.bnpl_providers", "Buy now, pay later"], ["payments.payment_icons", "Payment logos shown"],
    ["payments.interest_free_offers", "Interest-free offers"], ["payments.layby", "Lay-by"], ["payments.card_surcharge", "Card surcharge"]] },
  { id: "loyalty", title: "Loyalty", rows: [
    ["loyalty.program", "Programme"], ["loyalty.joining_fee", "Joining fee", (v) => money(v) ?? fmt(v)],
    ["loyalty.welcome_offer", "Welcome offer"], ["loyalty.birthday_reward", "Birthday"], ["loyalty.referral_reward", "Referral"],
    ["loyalty.earn_rate", "Earning"], ["loyalty.tiers", "Tiers"], ["loyalty.member_only_offers", "Member-only offers"],
    ["loyalty.subscription_discount", "Subscribe & save"], ["loyalty.gift_registry", "Gift registry"], ["loyalty.trade_in_program", "Trade-in"]] },
  { id: "support", title: "Support & services", rows: [
    ["trust_support.support_channels", "Channels"], ["trust_support.support_hours", "Hours"],
    ["trust_support.response_time", "Response time"], ["trust_support.engraving", "Engraving"],
    ["trust_support.free_resizing", "Resizing"], ["trust_support.size_guide", "Size guide"],
    ["trust_support.prescriptions_online", "Prescriptions online"], ["trust_support.pharmacist_advice", "Pharmacist advice"],
    ["trust_support.pet_services", "Pet services"], ["trust_support.safety_standards_mentioned", "Mentions safety standards"],
    ["trust_support.servicing", "Servicing & fitting"], ["trust_support.installation_service", "Installation"],
    ["promotions.free_samples", "Free samples"], ["policies.warranty_length", "Warranty"],
    ["policies.extended_care_plan", "Care plan", (v) => (typeof v === "string" ? fmt(v) : Array.isArray(v?.plans) ? `${v.plans.join(" and ")} plans, priced by item value` : "Offered")]] },
  { id: "tech", title: "Tech & AI readiness", rows: [
    ["tech_stack.platform", "Platform"], ["tech_stack.technologies", "Tools"], ["ai_readiness.llms_txt", "llms.txt"],
    ["ai_readiness.agent_commerce_endpoint", "AI shopping endpoint"], ["ai_readiness.schema_types_homepage", "Structured data"]] },
  { id: "business", title: "The business", rows: [
    ["site_identity.store_count", "Stores"], ["site_identity.states_with_stores", "States", (v) => (Array.isArray(v) ? v.map((x: string) => String(x).toUpperCase()).join(", ") : fmt(v))],
    ["site_identity.product_url_count", "Product pages"], ["site_identity.social_profiles", "Social profiles", (v) => `${v.length}`]] },
];

// ---------- dates ----------
const TZ = "Australia/Adelaide";
export const dateAU = (d: string | Date | number, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: TZ, ...o }).format(new Date(d));
export const dayKey = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));

// ---------- explore ----------
export const slug = (s: string) => String(s ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type Facet = { kind: string; value: string; name: string; test: (s: Site) => boolean };
export const POLICIES: Omit<Facet, "kind">[] = [
  { value: "30-day-returns", name: "30-day returns or longer", test: (s) => (num(s, "policies.returns.period_days") ?? 0) >= 30 },
  { value: "14-day-returns", name: "14-day returns or shorter", test: (s) => { const n = num(s, "policies.returns.period_days"); return n !== undefined && n <= 14; } },
  { value: "free-returns", name: "Free returns", test: (s) => val(s, "policies.returns.free_returns") === true },
  { value: "loyalty-programme", name: "Loyalty programme", test: (s) => !!fact(s, "loyalty.program") && fact(s, "loyalty.program")!.s === "observed" },
  { value: "free-shipping-under-80", name: "Free shipping under $80", test: (s) => { const n = num(s, "shipping.free_shipping_threshold"); return n !== undefined && n < 80; } },
  { value: "click-and-collect", name: "Click and collect", test: (s) => val(s, "shipping.click_and_collect") === true },
  { value: "same-day-delivery", name: "Same-day delivery", test: (s) => val(s, "shipping.same_day_available") === true },
  { value: "ai-shopping-endpoint", name: "AI shopping endpoint", test: (s) => !!val(s, "ai_readiness.agent_commerce_endpoint") },
  { value: "llms-txt", name: "Has llms.txt", test: (s) => val(s, "ai_readiness.llms_txt") === true },
];
export const WALLETS = ["apple_pay", "google_pay", "paypal", "shop_pay"];

export function facets(sites: Site[]): Record<string, Facet[]> {
  const out: Record<string, Facet[]> = { payments: [], tech: [], platform: [], segment: [], policy: [] };
  const pay = new Set<string>();
  sites.forEach((s) => { list(s, "payments.bnpl_providers").forEach((p) => pay.add(p)); list(s, "payments.payment_icons").filter((p) => WALLETS.includes(p)).forEach((p) => pay.add(p)); });
  pay.forEach((p) => out.payments.push({ kind: "payments", value: slug(p), name: label(p),
    test: (s) => list(s, "payments.bnpl_providers").includes(p) || list(s, "payments.payment_icons").includes(p) }));
  const tech = new Map<string, string>();
  sites.forEach((s) => (val(s, "tech_stack.technologies") || []).forEach((t: string) => tech.set(slug(t), t)));
  tech.forEach((name, v) => out.tech.push({ kind: "tech", value: v, name, test: (s) => (val(s, "tech_stack.technologies") || []).some((t: string) => slug(t) === v) }));
  const plat = new Map<string, string>();
  sites.forEach((s) => { const p = val(s, "tech_stack.platform"); if (typeof p === "string") plat.set(slug(p), p); });
  plat.forEach((name, v) => out.platform.push({ kind: "platform", value: v, name, test: (s) => slug(String(val(s, "tech_stack.platform") || "")) === v }));
  const seg = new Map<string, string>();
  sites.forEach((s) => s.segment && seg.set(slug(s.segment), s.segment));
  seg.forEach((name, v) => out.segment.push({ kind: "segment", value: v, name, test: (s) => !!s.segment && slug(s.segment) === v }));
  out.policy = POLICIES.map((p) => ({ ...p, kind: "policy" }));
  for (const k of Object.keys(out)) {
    out[k] = out[k].map((f) => ({ ...f, n: sites.filter(f.test).length } as any)).filter((f: any) => f.n > 0)
      .sort((a: any, b: any) => b.n - a.n);
  }
  return out;
}
export const KIND_NAMES: Record<string, string> = { payments: "Payment options", tech: "Technologies", platform: "Platforms", segment: "Segments", policy: "Policies" };
export const KIND_SINGULAR: Record<string, string> = { payments: "Payment option", tech: "Technology", platform: "Platform", segment: "Segment", policy: "Policy" };
/** Where one payment option, technology, platform or policy lives on the site. */
export const facetHref = (kind: string, value: string) =>
  kind === "tech" ? `/tech/${value}` : kind === "payments" ? `/payments/${value}` : kind === "platform" ? `/platforms/${value}`
    : kind === "policy" ? `/policies/${value}` : `/sites`;
/** The overview page for a kind of facet. */
export const KIND_HOME: Record<string, string> = { payments: "/payments", tech: "/tech", platform: "/platforms", policy: "/policies", segment: "/sites" };

// ---------- stats ----------
export const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const a = [...xs].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const maxPct = (p: Promo) => {
  const t = `${p.name} ${p.discount || ""}`;
  const m = [...t.matchAll(/(\d{1,2})\s*%/g)].map((x) => Number(x[1]));
  return m.length ? Math.max(...m) : 0;
};
/** Running now: seen in the site's latest scan, and its advertised end date (if any) hasn't passed. */
export const isLive = (p: Promo, today = new Date().toISOString().slice(0, 10)) => p.live && (!p.ends || p.ends.slice(0, 10) >= today);
export const isDiscount = (p: Promo) => maxPct(p) > 0 || ["percent_off", "dollar_off", "bogo", "gift_with_purchase"].includes(p.type || "");
export const PROMO_TYPES: Record<string, string> = {
  percent_off: "% off", free_shipping: "Free shipping", finance_offer: "Finance offers", gift_with_purchase: "Gift with purchase",
  dollar_off: "$ off", bogo: "Buy X get Y", loyalty_bonus: "Loyalty bonus", bundle: "Bundles", prize_draw: "Prize draws",
};

// ---------- change sentences ----------
const KEY_LABEL: Record<string, string> = {};
CARDS.forEach((c) => c.rows.forEach(([k, l]) => (KEY_LABEL[k] = l.toLowerCase())));
Object.assign(KEY_LABEL, {
  "shipping.free_shipping_threshold": "free-shipping threshold", "shipping.standard_shipping_cost": "standard delivery fee",
  "shipping.express_cost": "express delivery fee", "policies.returns.period_days": "returns window",
  "payments.bnpl_providers": "buy now, pay later options", "tech_stack.technologies": "tools", "loyalty.program": "loyalty programme",
});
const amount = (v: any) => (v && typeof v === "object" && typeof v.amount === "number" ? v.amount : typeof v === "number" ? v : undefined);
const IMPORTANT = /free_shipping_threshold|standard_shipping_cost|period_days|bnpl_providers|loyalty\.program|change_of_mind|free_returns|technologies|platform|store_count|joining_fee|welcome_offer/;

export function describeChange(c: Change): { text: string; significance: "High" | "Medium" | "Low" } {
  const what = KEY_LABEL[c.key] || c.key.split(".").pop()!.replace(/_/g, " ");
  const sig = IMPORTANT.test(c.key) ? "High" : /policies|shipping|payments|loyalty/.test(c.key) ? "Medium" : "Low";
  if (Array.isArray(c.from) && Array.isArray(c.to)) {
    const a = c.to.filter((x: any) => !c.from.includes(x)), r = c.from.filter((x: any) => !c.to.includes(x));
    const parts = [a.length ? `added ${a.map((x: any) => label(String(x))).join(", ")}` : "", r.length ? `dropped ${r.map((x: any) => label(String(x))).join(", ")}` : ""].filter(Boolean);
    if (parts.length) return { text: `${parts.join(" and ")} (${what})`, significance: sig };
  }
  if (c.from_status !== "observed" && c.to_status === "observed") return { text: `now shows ${what}: ${fmt(c.to)}`, significance: sig };
  if (c.from_status === "observed" && c.to_status !== "observed") return { text: `no longer shows ${what} (was ${fmt(c.from)})`, significance: sig };
  const a = amount(c.from), b = amount(c.to);
  if (a !== undefined && b !== undefined && a !== b) {
    const f = (x: any) => (c.key.endsWith("period_days") ? `${amount(x)} days` : fmt(x));
    return { text: `${b > a ? "raised" : "cut"} its ${what} from ${f(c.from)} to ${f(c.to)}`, significance: sig };
  }
  return { text: `changed its ${what} from ${fmt(c.from)} to ${fmt(c.to)}`, significance: sig };
}
