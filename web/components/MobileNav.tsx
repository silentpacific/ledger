"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COMPANY, INDUSTRY_LINKS, INSIGHTS } from "./nav";

/** Phones and tablets: a menu button that opens the whole menu, with Industries, Insights and Company as expandable blocks. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
  }, [open]);
  const block = (name: string, items: [string, string, string?][], extra?: [string, string]) => (
    <details className="mn-block">
      <summary>{name}</summary>
      <div>
        {items.map(([h, t]) => <Link key={h} href={h} onClick={() => setOpen(false)}>{t}</Link>)}
        {extra && <Link href={extra[0]} onClick={() => setOpen(false)}>{extra[1]}</Link>}
      </div>
    </details>
  );
  return (
    <>
      <button type="button" className="mn-btn" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((x) => !x)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="mn-panel">
          <form action="/search" role="search" className="hd-search" style={{ width: "100%", margin: "0 0 12px" }}>
            <label htmlFor="m-search" className="sr">Search</label>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input id="m-search" name="q" type="search" placeholder="Search stores, tools, payments" />
          </form>
          {block("Industries", INDUSTRY_LINKS, ["/industries", "All industries"])}
          {block("Insights", INSIGHTS)}
          <Link className="mn-link" href="/compare" onClick={() => setOpen(false)}>Compare</Link>
          <Link className="mn-link" href="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
          {block("Company", COMPANY)}
        </div>
      )}
    </>
  );
}
