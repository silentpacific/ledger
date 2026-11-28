import { industryPlates } from "@/lib/iso";

/** Nine isometric plates, one per industry, each linking to its industry page. */
export default function Plates({ counts }: { counts: Record<string, number> }) {
  const plates = industryPlates(counts);
  return (
    <svg viewBox="370 0 700 490" width="100%" style={{ display: "block", maxWidth: 860, margin: "40px auto 0" }} role="group" aria-label="The nine industries we track">
      {plates.map((p) => (
        <a key={p.slug} href={`/industries/${p.slug}`} aria-label={`${p.name}: ${p.n} stores`}>
          {p.shapes.map((s, k) => <path key={k} d={s.d} fill={s.f} stroke={s.st} strokeWidth={s.sw} opacity={s.o} strokeLinejoin="round" strokeLinecap="round" />)}
          {p.texts.map((t, k) => <text key={k} transform={t.m} fontFamily="Inter" fontWeight={t.w} fontSize={t.size} fill={t.f} textAnchor="middle">{t.s}</text>)}
        </a>
      ))}
    </svg>
  );
}
