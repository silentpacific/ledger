"use client";
import Link from "next/link";

/** The one placeholder for paid features: a blurred preview, a lock, the plan it belongs to and a link to the plans.
 * Each click sends a GA4 event (locked_feature_click) with the feature and the plan. */
export default function Locked({ feature, plan, title, children }: { feature: string; plan: "Premium" | "Pro"; title: string; children: React.ReactNode }) {
  const track = () => { try { (window as any).gtag?.("event", "locked_feature_click", { feature, plan }); } catch {} };
  return (
    <div style={{ position: "relative", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 18, padding: 26, overflow: "hidden" }}>
      <div aria-hidden="true" style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>{children}</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", background: "rgba(255,255,255,.55)", padding: 20 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 20, background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="18" viewBox="0 0 16 18"><rect x="1" y="8" width="14" height="9" rx="2" fill="#FACC15" /><path d="M4 8V5a4 4 0 0 1 8 0v3" fill="none" stroke="#FACC15" strokeWidth="2" /></svg>
        </span>
        <p style={{ margin: "12px 0 0", fontSize: 16, fontWeight: 800 }}>{title}</p>
        <p style={{ margin: "4px 0 14px", fontSize: 13, color: "#475569" }}>Part of {plan}</p>
        <Link href="/pricing" onClick={track} className="h-btn y" style={{ height: 42, fontSize: 14, borderRadius: 10 }}>See plans</Link>
      </div>
    </div>
  );
}
