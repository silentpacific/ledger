import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import ContactForm from "@/components/ContactForm";
import { BRAND } from "@/lib/brand";
import { pageSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui";

export const metadata: Metadata = { title: "Contact us", description: `Questions about the data, a fact that looks wrong, or early access to ${BRAND}.`, alternates: { canonical: "/contact" } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <>
      <Header />
      <JsonLd data={pageSchema({ type: "ContactPage", name: "Contact us", path: "/contact", crumbs: [["Contact"]] })} />
      <main className="narrow page" style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="eyebrow">Contact us</div>
          <h1 className="title">Talk to us</h1>
          <p className="prose" style={{ marginTop: 14 }}>Questions about the data, a fact that looks wrong, or interest in early access? We're a small Australian team and read every message.</p>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16, fontSize: 15 }}>
            <div><strong>Email</strong><div className="muted">hello@[domain].com.au</div></div>
            <div><strong>Based in</strong><div className="muted">[City], Australia · we reply within [1–2] business days</div></div>
            <div><strong>ABN</strong><div className="muted">[ABN]</div></div>
            <div><strong>Site owners</strong><div className="muted">To stop us tracking your store, use the <Link href="/methodology#opt-out">opt-out form</Link>.</div></div>
          </div>
        </div>
        <div style={{ flex: "1 1 440px", minWidth: 0 }}><ContactForm topic={topic} /></div>
      </main>
    </>
  );
}
