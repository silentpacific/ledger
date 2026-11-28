import Link from "next/link";
import SuggestSite from "./SuggestSite";
import { BRAND } from "@/lib/brand";
import { COMPANY, INDUSTRY_LINKS, INSIGHTS, LEGAL } from "./nav";
import FooterCols from "./FooterCols";

/** Dark footer (Rahul, 28 Nov 2026): Industries, Insights, About and Policies columns, the suggest-a-store form. */
export default function Footer() {
  return (
    <footer className="ft">
      <FooterCols cols={[
        { title: "Industries", links: [...INDUSTRY_LINKS, ["/industries", "All industries"]] },
        { title: "Insights", links: INSIGHTS.map(([h, t]) => [h, t] as [string, string]) },
        { title: "About", links: COMPANY.map(([h, t]) => [h, t] as [string, string]) },
        { title: "Policies", links: LEGAL },
      ]} />
      <div className="ft-in ft-low">
        <div style={{ flex: "1 1 360px", minWidth: 0 }}><SuggestSite /></div>
        <span className="ft-c">© 2026 {BRAND} · Facts are observed on public web pages and dated. They are not advice.</span>
      </div>
    </footer>
  );
}
