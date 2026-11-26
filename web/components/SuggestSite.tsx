"use client";
import { useState } from "react";

const MSG: Record<string, (d: string) => string> = {
  tracked: (d) => `We already track ${d}. You'll find it under Sites.`,
  known: (d) => `We know about ${d}, but it isn't being tracked right now.`,
  terms_prohibit: (d) => `${d}'s terms don't allow automated collection, so we don't track this site.`,
  blocked: () => "This site blocks automated visitors, so we can't include it.",
  opted_out: () => "The owner of this site has asked us not to track it.",
  not_au: () => "We only cover Australian stores for now. We've noted it for later.",
  new: (d) => `Thanks! We'll check ${d}'s terms and add it if they allow it.`,
  invalid: () => "Enter a website address, like yourstore.com.au.",
  error: () => "Something went wrong. Please try again in a minute.",
};
const TONE: Record<string, [string, string]> = {
  tracked: ["#E3F2EF", "#0A4F48"], new: ["#E3F2EF", "#0A4F48"], terms_prohibit: ["#FBEEDC", "#6E3500"],
  blocked: ["#FBEEDC", "#6E3500"], opted_out: ["#FBEEDC", "#6E3500"],
};

export default function SuggestSite({ dark = true }: { dark?: boolean }) {
  const [v, setV] = useState("");
  const [res, setRes] = useState<{ outcome: string; domain: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: v, hp: (e.target as any).website?.value || "" }) });
      setRes(await r.json());
    } catch { setRes({ outcome: "error", domain: v }); }
    setBusy(false);
  }
  const [bg, fg] = res ? TONE[res.outcome] || ["#E6E8EC", "#15171C"] : ["", ""];
  return (
    <form onSubmit={check} style={{ maxWidth: 440 }}>
      <label htmlFor="suggest-site" style={{ display: "block", fontWeight: 600, color: dark ? "#F6F5F1" : "#15171C", marginBottom: 8 }}>Suggest a site to track</label>
      <input name="website" tabIndex={-1} autoComplete="off" className="sr" aria-hidden="true" />
      <div style={{ display: "flex", gap: 8 }}>
        <input id="suggest-site" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. yourstore.com.au"
          style={{ flex: "1 1 auto", minWidth: 0, height: 44, borderRadius: 8, border: `1px solid ${dark ? "#3A3F4A" : "#D5D2C8"}`, background: dark ? "#23262E" : "#fff", color: dark ? "#F6F5F1" : "#15171C", padding: "0 14px" }} />
        <button type="submit" disabled={busy} style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 8, background: dark ? "#5FD3C4" : "#0E6B62", color: dark ? "#15171C" : "#fff", fontWeight: 600, cursor: "pointer" }}>{busy ? "Checking…" : "Check"}</button>
      </div>
      {res && (
        <div role="status" style={{ marginTop: 10, borderRadius: 8, padding: "10px 14px", lineHeight: 1.45, background: bg, color: fg, fontSize: 14 }}>
          {(MSG[res.outcome] || MSG.error)(res.domain || v)}
        </div>
      )}
    </form>
  );
}
