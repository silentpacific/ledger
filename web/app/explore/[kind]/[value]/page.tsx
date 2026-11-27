import { notFound, permanentRedirect } from "next/navigation";
import { facetHref } from "@/lib/format";

// Old addresses: every list moved to its own section (/payments, /platforms, /policies, /tech). Kept so old links still work.
type P = { params: Promise<{ kind: string; value: string }>; searchParams: Promise<{ industry?: string }> };

export default async function MovedList({ params, searchParams }: P) {
  const { kind, value } = await params;
  const { industry } = await searchParams;
  if (!["payments", "tech", "platform", "policy", "segment"].includes(kind)) notFound();
  permanentRedirect(`${facetHref(kind, value)}${industry && kind !== "segment" ? `?industry=${industry}` : ""}`);
}
