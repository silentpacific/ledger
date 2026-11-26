"use client";
import { useState } from "react";

const TOPICS = ["General question", "A fact looks wrong", "Early access / pricing", "Suggest an industry", "Partnerships", "Site owner opt-out"];

export default function ContactForm({ kind = "contact", topic }: { kind?: "contact" | "opt_out"; topic?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(f.entries());
    setState("sending");
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, kind }) });
      const j = await r.json();
      if (j.ok) setState("sent");
      else { setErr(j.error === "email" ? "Please check your email address." : "We couldn't send that. Please try again."); setState("error"); }
    } catch { setErr("We couldn't send that. Please try again."); setState("error"); }
  }
  if (state === "sent") {
    return <div role="status" className="card" style={{ background: "var(--accent-soft)", color: "var(--accent-dark)", borderColor: "transparent" }}>
      {kind === "opt_out" ? "Thanks. We've received your opt-out request and will confirm by email once your site is removed." : "Thanks, your message is on its way. We read every one."}
    </div>;
  }
  const initialTopic = topic === "wrong-fact" ? "A fact looks wrong" : TOPICS[0];
  return (
    <form onSubmit={submit} className="card grid g2" style={{ padding: 28, gap: 16, fontSize: 14 }}>
      <input name="hp" tabIndex={-1} autoComplete="off" className="sr" aria-hidden="true" />
      {kind === "opt_out" ? <>
        <div><label className="lbl" htmlFor="c-site">Website</label><input id="c-site" name="website" required placeholder="yourstore.com.au" className="field" /></div>
        <div><label className="lbl" htmlFor="c-email">Work email</label><input id="c-email" name="email" type="email" required placeholder="you@yourstore.com.au" className="field" /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="c-msg">Anything else (optional)</label><textarea id="c-msg" name="message" rows={3} className="field" /></div>
      </> : <>
        <div><label className="lbl" htmlFor="c-name">Name</label><input id="c-name" name="name" required className="field" /></div>
        <div><label className="lbl" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" required className="field" /></div>
        <div><label className="lbl" htmlFor="c-co">Company (optional)</label><input id="c-co" name="company" className="field" /></div>
        <div><label className="lbl" htmlFor="c-topic">What's it about?</label><select id="c-topic" name="topic" defaultValue={initialTopic} className="field">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="lbl" htmlFor="c-msg">Message</label><textarea id="c-msg" name="message" rows={6} required className="field" /></div>
      </>}
      <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <span className="small muted">{state === "error" ? <span style={{ color: "#9A2A1A" }}>{err}</span> : kind === "opt_out" ? "We'll confirm by email." : "If a fact looks wrong, include the store and the page."}</span>
        <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : kind === "opt_out" ? "Send opt-out request" : "Send message"}</button>
      </div>
    </form>
  );
}
