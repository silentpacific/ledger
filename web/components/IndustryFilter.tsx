import Link from "next/link";
import type { Counts } from "@/lib/data";
import { INDUSTRIES } from "@/lib/industries";

/** Primary filter: industry, as tabs, with each industry's store count. `extra` renders secondary filters below.
 * Changing a filter keeps the reader's place. (Segments are switched off; see SEGMENTS_ENABLED.) */
export default function IndustryFilter({ path, counts, industry, keep = {}, extra }: {
  path: string; counts: Counts; industry?: string; segment?: string; keep?: Record<string, string | undefined>; extra?: React.ReactNode;
}) {
  const query = { ...keep, industry };
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...query, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return p ? `${path}?${p}` : path;
  };
  return (
    <div className="filters">
      <nav className="ftabs" aria-label="Industry">
        <Link scroll={false} href={href({ industry: undefined, page: undefined })} aria-current={!industry ? "page" : undefined}>
          All industries<span className="n">{counts.all}</span>
        </Link>
        {INDUSTRIES.map((i) => ({ i, n: counts.ind[i.slug] || 0 })).filter(({ n }) => n > 0).map(({ i, n }) => (
          <Link scroll={false} key={i.slug} href={href({ industry: i.slug, page: undefined })} aria-current={industry === i.slug ? "page" : undefined}>
            {i.name}<span className="n">{n}</span>
          </Link>
        ))}
      </nav>
      {extra && <div className="fsub">{extra}</div>}
    </div>
  );
}
