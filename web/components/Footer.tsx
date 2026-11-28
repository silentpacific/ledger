import Link from "next/link";
import SuggestSite from "./SuggestSite";
import { BRAND } from "@/lib/brand";
import { COMPANY, INDUSTRY_LINKS, INSIGHTS, LEGAL } from "./nav";

const col = (title: string, links: [string, string, ...unknown[]][]) => (
  <nav aria-label={title} className="ft-col">
    <div className="ft-h">{title}</div>
    {links.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}
  </nav>
);

/** Dark footer (Rahul, 28 Nov 2026): Industries, Insights, About and Policies columns, the suggest-a-store form. */
export default function Footer() {
  return (
    <footer className="ft">
      <div className="ft-in ft-cols">
        {col("Industries", [...INDUSTRY_LINKS, ["/industries", "All industries"]])}
        {col("Insights", INSIGHTS)}
        {col("About", COMPANY)}
        {col("Policies", LEGAL)}
      </div>
      <div className="ft-in ft-low">
        <div style={{ flex: "1 1 360px", minWidth: 0 }}><SuggestSite /></div>
        <span className="ft-c">© 2026 {BRAND} · Facts are observed on public web pages and dated. They are not advice.</span>
      </div>
    </footer>
  );
}
