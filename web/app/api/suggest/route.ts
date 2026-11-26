import { NextResponse } from "next/server";
import { suggestSite } from "@/lib/data";

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  if (body.hp) return NextResponse.json({ outcome: "new", domain: "" }); // hidden trap field filled: a bot
  const raw = String(body.domain || "").slice(0, 200);
  try {
    const r = await suggestSite(raw);
    // we only cover Australian stores: .au domains, plus .com stores we can't rule out
    if (r.outcome === "new" && r.domain && !/\.au$|\.com$|\.co$|\.store$|\.shop$/.test(r.domain)) {
      return NextResponse.json({ outcome: "not_au", domain: r.domain });
    }
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ outcome: "error", domain: raw }, { status: 500 });
  }
}
