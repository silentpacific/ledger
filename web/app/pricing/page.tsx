import Header from "@/components/Header";

export const metadata = { title: "Pricing", description: "Free shows what is true now for every store. Premium and Pro add change history, alerts and exports.", alternates: { canonical: "/pricing" } };

const TIERS = [
  { name: "Free", price: "Free", line: "What is true now, for every store", items: ["Every store's current facts", "Industry figures and medians", "Compare up to 3 stores"] },
  { name: "Premium", price: "[Price to come]", line: "How it got there", items: ["Everything in Free", "Change history for every fact", "Alerts when a store changes", "Up to 5 people"] },
  { name: "Pro", price: "[Price to come]", line: "For teams that report on the market", items: ["Everything in Premium", "Exports to CSV and Excel", "Full benchmarks", "Up to 5 people"] },
];

/** Placeholder until accounts and payments are built: the three tiers, no checkout. */
export default function Pricing() {
  return (
    <>
      <Header active="/pricing" />
      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "72px 96px 96px", fontFamily: "Inter, system-ui, sans-serif" }}>
        <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "#B45309" }}>Pricing</p>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1, letterSpacing: "-1px", fontWeight: 800, fontFamily: "Inter, system-ui, sans-serif" }}>Free shows what's true now. Paid shows how it got there.</h1>
        <p style={{ margin: "16px 0 0", fontSize: 17, color: "#475569", maxWidth: 640, lineHeight: 1.55 }}>Accounts and paid plans are on the way. Everything on the site is free to browse until then.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 40 }}>
          {TIERS.map((t) => (
            <section key={t.name} style={{ border: `1px solid ${t.name === "Premium" ? "#FACC15" : "#E2E8F0"}`, borderRadius: 18, padding: 28 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: "Inter, system-ui, sans-serif" }}>{t.name}</h2>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>{t.line}</p>
              <p style={{ margin: "18px 0 0", fontSize: 30, fontWeight: 800 }}>{t.price}</p>
              <ul style={{ margin: "18px 0 0", paddingLeft: 18, lineHeight: 1.9, color: "#334155" }}>{t.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
