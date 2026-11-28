import Link from "next/link";
import HeroLookup from "./HeroLookup";
import PhoneScreen from "./Phone";
import { sceneLayers } from "@/lib/iso";

export type SceneFacts = { total: number; onSale: string; bnplPct: number; afterpay: number; retMode: number | null };

/** The hero: a flat phone showing a store; scrolling zooms into it, tilts it onto the top of four layers
 * (store, promotions, payments, policies), lights each layer in turn, then merges them back into the phone.
 * It plays only while the pointer is over the picture: a see-through scroller over it drives a CSS scroll-timeline, and once it
 * reaches either end the page scrolls on. Phones and older browsers get the opening frame. */
export default function Scene({ f }: { f: SceneFacts }) {
  const layers = sceneLayers();
  const panels = [
    { k: "1 of 4 · The online store", h: `${f.total} stores, read every week`, b: "Each store's platform, apps and product pages, and the path from product to cart to checkout.", a: "See technologies", href: "/tech", col: "#334155" },
    { k: "2 of 4 · Promotions", h: `${f.onSale} are running an offer right now`, b: "Every sale, code and free gift we can see, with the date we first saw it and the date it ended.", a: "See promotions", href: "/promotions", col: "#B45309" },
    { k: "3 of 4 · Payment options", h: `${f.bnplPct}% offer buy now, pay later`, b: `Which cards, wallets and pay-later providers each store takes. Afterpay leads, at ${f.afterpay} stores.`, a: "See payments", href: "/payments", col: "#0E7C6B" },
    { k: "4 of 4 · Policies", h: f.retMode ? `${f.retMode} days is the most common returns window` : "Returns, warranty and delivery terms", b: "Returns, change of mind, warranty and delivery terms, quoted word for word from each store's own pages.", a: "See policies", href: "/policies", col: "#1D4ED8" },
  ];
  return (
    <section className="s-scn" aria-label="Australian eCommerce Intelligence. At your fingertips">
      <div className="s-stage">
        <div className="s-box">
          <div className="s-intro" style={{ position: "absolute", left: 96, top: 150, width: 600, zIndex: 2 }}>
            <p className="h-eye">Your eye in the sky</p>
            <h1 className="s-h1" style={{ margin: 0, fontSize: 40, lineHeight: 1.1, letterSpacing: "-1.3px", fontWeight: 800 }}>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>Australian eCommerce Intelligence.</span>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>At your fingertips</span></h1>
            <p style={{ margin: "22px 0 30px", fontSize: 19, lineHeight: 1.5, color: "#475569", maxWidth: 520 }}>
              Returns, shipping, payments, promotions and tech for {f.total} online stores, quoted from each store's own pages and checked every week.</p>
            <HeroLookup />
            <div className="s-trust" style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", marginTop: 20, fontSize: 14, color: "#475569" }}>
              <span>✓ Free to browse</span><span>✓ Every fact quoted and dated</span><span>✓ Updated weekly</span></div>
            <p className="s-hint" style={{ margin: "56px 0 0", fontSize: 13, fontWeight: 600, color: "#94A3B8" }}><span className="s-hint-d">Scroll over the phone to look inside the store →</span><span className="s-hint-m">Swipe up on the phone to look inside the store ↓</span></p>
          </div>

          <div className="s-texts">
          {panels.map((p, i) => (
            <div key={p.k} className={`s-pn s-p${i}`}>
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: p.col }}>{p.k}</p>
              <h2 style={{ margin: 0, fontSize: 40, lineHeight: 1.1, letterSpacing: "-1px", fontWeight: 800 }}>{p.h}</h2>
              <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.55, color: "#475569" }}>{p.b}</p>
              <Link href={p.href} className="h-link" style={{ display: "inline-block", marginTop: 22, color: p.col }}>{p.a}</Link>
            </div>
          ))}
          <div className="s-outro" style={{ position: "absolute", left: 96, top: 290, width: 450 }}>
            <h2 style={{ margin: 0, fontSize: 44, lineHeight: 1.1, letterSpacing: "-1px", fontWeight: 800 }}>Every layer behind the store, in one place.</h2>
            <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.55, color: "#475569" }}>Type a store to see what sits behind its pages, or pick an industry to see how its stores compare.</p>
            <Link href="/industries" className="h-btn" style={{ marginTop: 26 }}>Browse industries</Link>
          </div>
          <div className="s-barw" aria-hidden="true" style={{ position: "absolute", left: 56, top: 300, width: 3, height: 300, background: "#E2E8F0", borderRadius: 2 }}>
            <div className="s-bar" style={{ width: 3, height: 300, background: "#0F172A", borderRadius: 2 }} /></div>

          </div>

          <div className="s-art"><div className="s-art-in">
          <svg className="s-layers" viewBox="0 0 1440 900" width="1440" height="900" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
            <defs>
              <linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient>
              <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8FAFC" /><stop offset="1" stopColor="#E2E8F0" /></linearGradient>
            </defs>
            {layers.map((L, i) => (
              <g key={i} className={L.inc}><g className={L.fo}>
                {L.shapes.map((s, k) => <path key={k} d={s.d} fill={s.f} stroke={s.st} strokeWidth={s.sw} opacity={s.o} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" className={s.c || undefined} style={s.style ? { animationDelay: s.style.replace("animation-delay:", "") } : undefined} />)}
                {L.texts.map((t, k) => <text key={k} transform={t.m} fontFamily="Inter" fontWeight={800} fontSize={t.size} fill={t.f} textAnchor="middle">{t.s}</text>)}
              </g></g>
            ))}
          </svg>

          <div className="s-scroller" tabIndex={0} aria-label="Scroll here to look inside the store, layer by layer"><div style={{ height: 5400 }} /></div>
          <div className="s-fo s-fo0" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="s-ph">
              <div className="s-glow"><div className="s-breathe" style={{ width: "100%", height: "100%", borderRadius: 54, boxShadow: "0 0 0 1px rgba(253,224,71,.55),0 0 42px 6px rgba(250,204,21,.38),0 0 110px 24px rgba(253,230,138,.30)" }} /></div>
              <div className="s-frame"><div style={{ position: "absolute", left: 117, top: 14, width: 90, height: 26, borderRadius: 13, background: "#000" }} /></div>
              <div className="s-screen" aria-label="A phone showing an example online store" role="img"><PhoneScreen /></div>
            </div>
          </div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
