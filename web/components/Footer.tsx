import Link from "next/link";
import SuggestSite from "./SuggestSite";
import { BRAND } from "@/lib/brand";

const LINKS: [string, string][] = [
  ["/industries", "Industries"], ["/sites", "Stores"], ["/compare", "Compare"], ["/payments", "Payments"], ["/promotions", "Promotions"],
  ["/policies", "Policies"], ["/tech", "Technologies"], ["/benchmarks", "Benchmarks"], ["/methodology", "Methodology"], ["/about", "About"],
  ["/contact", "Contact"], ["/methodology#privacy", "Privacy policy"], ["/methodology#terms", "Terms"],
];

/** One row of links (Rahul, 28 Nov 2026), plus the suggest-a-store form and the opt-out link site owners need. */
export default function Footer() {
  return (
    <footer className="ft">
      <div className="ft-in ft-top">
        <div style={{ flex: "1 1 360px", minWidth: 0 }}><SuggestSite dark={false} /></div>
        <p className="ft-note">Site owner? <Link href="/methodology#opt-out">Opt out of tracking</Link> or <Link href="/contact?topic=wrong-fact">report a wrong fact</Link>.</p>
      </div>
      <div className="ft-in ft-row">
        <nav aria-label="Footer" className="ft-links">{LINKS.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}</nav>
        <span className="ft-c">© 2026 {BRAND}</span>
      </div>
    </footer>
  );
}
