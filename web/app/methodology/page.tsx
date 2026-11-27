import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import ContactForm from "@/components/ContactForm";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `How ${BRAND} works: methodology, quality rules and opt-out`,
  description: `How ${BRAND} collects and checks facts from Australian online stores, what the labels mean, which sites we don't track, and how site owners can opt out.`,
  alternates: { canonical: "/methodology" },
};

const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div className="card" style={{ padding: 14, fontSize: 15 }}><strong>{t}</strong><br />{children}</div>
);

export default function Methodology() {
  return (
    <>
      <Header />
      <div className="wrap page" style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
        <nav aria-label="On this page" style={{ flex: "1 1 200px", maxWidth: 240, display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
          <div className="tiny muted" style={{ fontWeight: 600 }}>On this page</div>
          <a href="#collect">What we collect</a><a href="#how">How we collect it</a><a href="#check">How we check facts</a><a href="#dates">Dates and changes</a>
          <a href="#words">What the labels mean</a><a href="#notrack">Sites we don't track</a><a href="#opt-out">Opt out</a><a href="#privacy">Privacy</a><a href="#terms">Terms of use</a>
        </nav>
        <main className="prose" style={{ flex: "999 1 560px", minWidth: 0, maxWidth: 780 }}>
          <h1 className="title" style={{ color: "var(--ink)" }}>How {BRAND} works</h1>
          <p className="muted" style={{ marginTop: 12 }}>Every fact on {BRAND} was read from a public page of an Australian online store, on a date we show, with the words it came from.</p>
          <h2 id="collect">What we collect</h2>
          <p>Thirteen areas: who the business is, its policies (returns, warranty, terms), shipping, products and prices for a small watch list, promotions, payment options including buy now pay later, the technology it uses, the shopping journey, trust and support, external review ratings, loyalty programmes, content activity, and how readable the site is for AI shopping assistants.</p>
          <h2 id="how">How we collect it</h2>
          <ul style={{ paddingLeft: 22 }}>
            <li>Public pages only. We never log in, fill in checkouts or get around a block.</li>
            <li>We follow each site's robots.txt, wait between requests, and identify ourselves as LedgerBot.</li>
            <li>Before collecting anything, we read the site's terms, and stop if they contain an anti-scraping clause written by the site. We record when a site only uses its platform's standard template wording.</li>
            <li>We keep facts and short quotes, never copies of pages, and we leave out personal information.</li>
          </ul>
          <h2 id="check">How we check facts</h2>
          <p>Code reads what it can: technology, structured data and prices. For policy text, two independent AI reads must agree, and the quote behind each answer must appear word for word on the page. When the reads disagree, a stronger model settles it; if that fails, the fact is held back. Nothing is checked by hand, so the rules are the same for every site.</p>
          <h2 id="dates">Dates and changes</h2>
          <p>Promotions, the product watch list and content are scanned weekly; everything else monthly. A change appears in the feed only after the next scan confirms it, and rewording alone never counts as a change. Prices are stored only when they change, so each product has a clean price history.</p>
          <h2 id="words">What the labels mean</h2>
          <div className="grid g2" style={{ gap: 12 }}>
            <L t="Not stated">The site doesn't publish it. It may still offer it.</L>
            <L t="Not offered">The site says plainly that it doesn't offer it.</L>
            <L t="Confirmed">Seen on two scans in a row, quote checked.</L>
            <L t="Seen [date]">The last scan that read this fact.</L>
          </div>
          <h2 id="notrack">Sites we don't track</h2>
          <p>Sites whose own terms ban automated collection, sites that block our crawler, and sites whose owners ask us to stop. We recheck their terms once a month and only start again if they change.</p>
          <section id="opt-out" style={{ marginTop: 40 }}>
            <h2 style={{ marginTop: 0 }}>Site owners: opt out</h2>
            <p className="muted" style={{ fontSize: 15 }}>We'll stop scanning your site and remove what we hold within [X] business days. Please use an email address at your site's domain so we can confirm it's yours.</p>
            <ContactForm kind="opt_out" />
          </section>
          <h2 id="privacy">Privacy</h2>
          <p>[Privacy policy placeholder.] We don't collect personal information from the stores we track. Messages you send through our forms are used only to reply to you.</p>
          <h2 id="terms">Terms of use</h2>
          <p>[Terms of use placeholder.] Facts are observed on public web pages on the dates shown and may have changed since. They are provided for information and are not advice. Questions? <Link href="/contact">Contact us</Link>.</p>
        </main>
      </div>
    </>
  );
}
