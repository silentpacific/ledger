// Simple SVG charts for the redesigned pages (server-rendered, no chart library).
export type Pair = [string, number];

/** Columns with a count above each and a label below. hi = index drawn in yellow (e.g. the band holding the median). */
export function Columns({ data, hi = -1, colors, label }: { data: Pair[]; hi?: number; colors?: string[]; label: string }) {
  const W = 600, max = Math.max(1, ...data.map((d) => d[1])), slot = (W - 40) / Math.max(1, data.length), w = Math.min(56, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${W} 236`} width="100%" style={{ display: "block", marginTop: 14 }} role="img" aria-label={`${label}: ${data.map(([l, n]) => `${l} ${n}`).join(", ")}`}>
      <line x1="20" y1="196" x2={W - 20} y2="196" stroke="#CBD5E1" />
      {data.map(([l, n], i) => {
        const h = n ? Math.max(4, (n / max) * 150) : 0, cx = 20 + slot * i + slot / 2;
        return (
          <g key={l}>
            <rect x={cx - w / 2} y={196 - h} width={w} height={h} rx="6" fill={colors ? colors[i] : i === hi ? "#FACC15" : "#0F172A"} />
            <text x={cx} y={188 - h} textAnchor="middle" fontFamily="Inter" fontSize="17" fontWeight="700" fill="#0F172A">{n}</text>
            <text x={cx} y="222" textAnchor="middle" fontFamily="Inter" fontSize={data.length > 6 ? 14 : 16} fill="#64748B">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The band that holds the middle store, for highlighting. */
export const medianBand = (data: Pair[]) => {
  const total = data.reduce((a, d) => a + d[1], 0);
  let c = 0;
  for (let i = 0; i < data.length; i++) { c += data[i][1]; if (c >= total / 2) return i; }
  return -1;
};

const dot = (c: string) => ({ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c, marginRight: 7, verticalAlign: -1 });

/** One 100% bar split into parts, with a legend. */
export function Split({ parts, colors, dark = false }: { parts: Pair[]; colors: string[]; dark?: boolean }) {
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
  return (
    <>
      <div style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden", marginTop: 12 }} role="img" aria-label={parts.map(([l, n]) => `${l} ${n}`).join(", ")}>
        {parts.map(([l, n], i) => <div key={l} style={{ width: `${(100 * n) / tot}%`, background: colors[i] }} />)}
      </div>
      <div className="i-legend" style={{ color: dark ? "#D1D5DB" : "#475569" }}>
        {parts.map(([l, n], i) => <span key={l}><i style={dot(colors[i])} />{l} <b style={{ color: dark ? "#FFFFFF" : "#0F172A" }}>{n}</b></span>)}
      </div>
    </>
  );
}

/** Horizontal bars as a share of a total. */
export function HBars({ rows, of, colors, track = "#EEF2F6", pct = true }: { rows: Pair[]; of: number; colors: string[] | string; track?: string; pct?: boolean }) {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map(([l, n], i) => (
        <div key={l} className="i-hbar">
          <span style={{ fontWeight: 600 }}>{l}</span>
          <div style={{ height: 12, borderRadius: 6, background: track, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (100 * n) / Math.max(1, of))}%`, background: Array.isArray(colors) ? colors[i % colors.length] : colors, borderRadius: 6 }} />
          </div>
          <span style={{ textAlign: "right", color: "#475569" }}>{pct ? <><b style={{ color: "#0F172A" }}>{Math.round((100 * n) / Math.max(1, of))}%</b> · {n}</> : <b style={{ color: "#0F172A" }}>{n}</b>}</span>
        </div>
      ))}
    </div>
  );
}

/** A ring chart with the leading share in the middle. */
export function Donut({ parts, colors, centre, sub }: { parts: Pair[]; colors: string[]; centre: string; sub: string }) {
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
  let a0 = -Math.PI / 2;
  const p = (a: number) => [100 + 92 * Math.cos(a), 100 + 92 * Math.sin(a)];
  return (
    <div className="i-donut">
      <svg viewBox="0 0 200 200" width="180" height="180" role="img" aria-label={parts.map(([l, n]) => `${l} ${n}`).join(", ")} style={{ flex: "none" }}>
        {parts.length === 1 && <circle cx="100" cy="100" r="92" fill={colors[0]} />}
        {parts.length > 1 && parts.map(([l, n], i) => {
          const a1 = a0 + (2 * Math.PI * n) / tot, s = p(a0), e = p(a1 - (parts.length > 1 ? 0.004 : 0.0001)), big = a1 - a0 > Math.PI ? 1 : 0;
          a0 = a1;
          return <path key={l} d={`M100,100 L${s[0].toFixed(1)},${s[1].toFixed(1)} A92,92 0 ${big} 1 ${e[0].toFixed(1)},${e[1].toFixed(1)} Z`} fill={colors[i % colors.length]} />;
        })}
        <circle cx="100" cy="100" r="58" fill="#FFFFFF" />
        <text x="100" y="98" textAnchor="middle" fontFamily="Inter" fontSize="28" fontWeight="800" fill="#0F172A">{centre}</text>
        <text x="100" y="118" textAnchor="middle" fontFamily="Inter" fontSize="12" fill="#64748B">{sub}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 14 }}>
        {parts.map(([l, n], i) => <span key={l}><i style={dot(colors[i % colors.length])} />{l} <b>{n}</b></span>)}
      </div>
    </div>
  );
}
