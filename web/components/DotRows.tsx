// One dot per row along a scale (e.g. each industry's median). hollow = thin data.
export type Dot = { label: string; value: number | null; text: string; hollow?: boolean };
export default function DotRows({ rows, lo, hi, loText, hiText, fill = "#0F172A", label }: { rows: Dot[]; lo: number; hi: number; loText: string; hiText: string; fill?: string; label: string }) {
  const X = (v: number) => 190 + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 330;
  const H = 20 + rows.length * 34;
  return (
    <svg viewBox={`0 0 600 ${H + 16}`} width="100%" style={{ display: "block", marginTop: 12 }} role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.text}`).join(", ")}`}>
      <line x1="190" y1="8" x2="190" y2={H} stroke="#E2E8F0" /><line x1="520" y1="8" x2="520" y2={H} stroke="#E2E8F0" />
      <text x="190" y={H + 14} fontFamily="Inter" fontSize="12" fill="#94A3B8" textAnchor="middle">{loText}</text>
      <text x="520" y={H + 14} fontFamily="Inter" fontSize="12" fill="#94A3B8" textAnchor="middle">{hiText}</text>
      {rows.map((r, i) => {
        const y = 24 + i * 34;
        return (
          <g key={r.label}>
            <text x="0" y={y + 5} fontFamily="Inter" fontSize="14" fill="#334155">{r.label}</text>
            <line x1="190" y1={y} x2="520" y2={y} stroke="#F1F5F9" />
            {r.value !== null && <>
              <circle cx={X(r.value)} cy={y} r="7" fill={r.hollow ? "#FFFFFF" : fill} stroke="#0F172A" strokeWidth="2" />
              <text x={X(r.value) + 14} y={y + 5} fontFamily="Inter" fontSize="13" fontWeight="700" fill="#0F172A">{r.text}</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}
