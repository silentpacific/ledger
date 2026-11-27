import Link from "next/link";
import type { Site } from "@/lib/data";
import { industryOf } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";
import FilterSelect from "./FilterSelect";

/** Primary filter: industry, as tabs. Secondary: that industry's segments, as a compact dropdown.
 * `extra` renders more secondary filters in the same row. Changing a filter keeps the reader's place. */
export default function IndustryFilter({ path, sites, industry, segment, keep = {}, extra }: {
  path: string; sites: Site[]; industry?: string; segment?: string; keep?: Record<string, string | undefined>; extra?: React.ReactNode;
}) {
  const query = { ...keep, industry, segment };
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...query, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return p ? `${path}?${p}` : path;
  };
  const inInd = industry ? sites.filter((s) => industryOf(s) === industry) : [];
  const segs = [...new Set(inInd.map((s) => s.segment).filter(Boolean))].sort() as string[];
  return (
    <div className="filters">
      <nav className="ftabs" aria-label="Industry">
        <Link scroll={false} href={href({ industry: undefined, segment: undefined })} aria-current={!industry ? "page" : undefined}>
          All industries<span className="n">{sites.length}</span>
        </Link>
        {INDUSTRIES.map((i) => ({ i, n: sites.filter((s) => industryOf(s) === i.slug).length })).filter(({ n }) => n > 0).map(({ i, n }) => (
          <Link scroll={false} key={i.slug} href={href({ industry: i.slug, segment: undefined })} aria-current={industry === i.slug ? "page" : undefined}>
            {i.name}<span className="n">{n}</span>
          </Link>
        ))}
      </nav>
      {(segs.length > 1 || extra) && (
        <div className="fsub">
          {segs.length > 1 && (
            <FilterSelect label="Segment" param="segment" value={segment} path={path} query={query}
              options={[{ value: "", label: `All segments (${inInd.length})` }, ...segs.map((g) => ({ value: g, label: `${g} (${inInd.filter((s) => s.segment === g).length})` }))]} />
          )}
          {extra}
        </div>
      )}
    </div>
  );
}
