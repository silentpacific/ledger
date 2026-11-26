import { redirect } from "next/navigation";

// Old filter links keep working: same query, now on the Sites page.
export default async function Filter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
  if (q.tech && Object.keys(q).length === 1) redirect(`/tech/${q.tech}`);
  redirect(p ? `/sites?${p}` : "/sites");
}
