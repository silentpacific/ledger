import { NextResponse } from "next/server";
import { sendContact } from "@/lib/data";

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  if (b.hp) return NextResponse.json({ ok: true });
  const s = (k: string) => String(b[k] ?? "").slice(0, 5000);
  try {
    const r = await sendContact({ p_kind: s("kind") === "opt_out" ? "opt_out" : "contact", p_name: s("name"), p_email: s("email"),
      p_company: s("company"), p_website: s("website"), p_topic: s("topic"), p_message: s("message") });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
