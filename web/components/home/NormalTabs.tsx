"use client";
import Link from "next/link";
import { useState } from "react";

export type NormalRow = { slug: string; name: string; n: number; fs: string; ret: string; bnpl: string; sale: string };

/** "What's normal in your industry?": one tab per industry, four headline figures each. */
export default function NormalTabs({ rows }: { rows: NormalRow[] }) {
  const [i, setI] = useState(0);
  const c = rows[i];
  if (!c) return null;
  const lower = c.name.toLowerCase();
  const fig = (v: string, l: string, col: string) => (
    <div style={{ borderLeft: `3px solid ${col}`, paddingLeft: 14 }}>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.5px" }}>{v}</div>
      <div style={{ fontSize: 14, color: "#64748B" }}>{l}</div>
    </div>
  );
  return (
    <>
      <div role="tablist" aria-label="Industries" className="h-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
        {rows.map((r, n) => (
          <button key={r.slug} type="button" role="tab" aria-selected={n === i} onClick={() => setI(n)}
            style={{ font: "inherit", fontSize: 15, fontWeight: 600, padding: "10px 16px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${n === i ? "#0F172A" : "#CBD5E1"}`, background: n === i ? "#0F172A" : "#FFFFFF", color: n === i ? "#FFFFFF" : "#0F172A" }}>{r.name}</button>
        ))}
      </div>
      <div role="tabpanel" style={{ marginTop: 22, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 18, padding: 30 }}>
        <p style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>A typical {lower} store <span style={{ fontWeight: 500, color: "#64748B", fontSize: 15 }}>· {c.n} stores</span></p>
        <div className="h-grid4" style={{ gap: 24 }}>
          {fig(c.fs, "median free-shipping minimum", "#15803D")}
          {fig(c.ret, "median returns window", "#1D4ED8")}
          {fig(c.bnpl, "offer buy now, pay later", "#0E7C6B")}
          {fig(c.sale, "running an offer now", "#B45309")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 24 }}>
          <Link href={`/industries/${c.slug}`} className="h-link">See all {lower} stores</Link>
          <Link href="/compare" className="h-link">Compare {lower} stores</Link>
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 12, color: "#64748B" }}>A median shows only when at least 60% of the industry's stores state the value; otherwise "Not enough data".</p>
      </div>
    </>
  );
}
