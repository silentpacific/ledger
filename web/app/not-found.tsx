import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="narrow page" style={{ minHeight: "50vh" }}>
        <h1 className="title">Page not found</h1>
        <p className="lede">We couldn't find that page. If it was a store, we may not track it yet: you can suggest it below.</p>
        <p><Link href="/" className="btn" style={{ marginTop: 16 }}>Back to this week</Link></p>
      </main>
    </>
  );
}
