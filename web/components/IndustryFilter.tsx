import Link from "next/link";
import type { Site } from "@/lib/data";
import { industryOf } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";

/** Industry chips, with that industry's segment chips underneath once one is picked. Keeps other query params. */
export default function IndustryFilter({ path, sites, industry, segment, keep = {} }: {
  path: string; sites: Site[]; industry?: string; segment?: string; keep?: Record<string, string | undefined>;
}) {
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return p ? `${path}?${p}` : path;
  };
  const inInd = industry ? sites.filter((s) => industryOf(s) === industry) : [];
  const segs = [...new Set(inInd.map((s) => s.segment).filter(Boolean))].sort() as string[];
  return (
    <div style={{ marginTop: 20 }}>
      <div className="row" style={{ gap: 8 }}>
        <Link href={href({ industry: undefined, segment: undefined })} className={`chip${!industry ? " on" : ""}`}>All industries · {sites.length}</Link>
        {INDUSTRIES.map((i) => ({ i, n: sites.filter((s) => industryOf(s) === i.slug).length })).filter(({ n }) => n > 0).map(({ i, n }) => (
          <Link key={i.slug} href={href({ industry: i.slug, segment: undefined })} className={`chip${industry === i.slug ? " on" : ""}`}>{i.name} · {n}</Link>
        ))}
      </div>
      {segs.length > 1 && (
        <div className="row" style={{ gap: 8, marginTop: 10, paddingLeft: 12, borderLeft: "3px solid var(--line2)" }}>
          <Link href={href({ industry, segment: undefined })} className={`chip${!segment ? " on" : ""}`}>All segments</Link>
          {segs.map((g) => <Link key={g} href={href({ industry, segment: g })} className={`chip${segment === g ? " on" : ""}`}>{g} · {inInd.filter((s) => s.segment === g).length}</Link>)}
        </div>
      )}
    </div>
  );
}
