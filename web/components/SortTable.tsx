"use client";
import Link from "next/link";
import { useState } from "react";

export type SortCell = { text: string; sort: number | string | null; sub?: string; href?: string; muted?: boolean; bg?: string };
export type SortRow = { id: string; cells: Record<string, SortCell> };
export type SortCol = { key: string; label: string; align?: "left" | "right" };

/** A table whose every column sorts on click (again to reverse). Rows without a value always sort last. */
export default function SortTable({ cols, rows, initial, initialDesc = false, minWidth = 900 }: { cols: SortCol[]; rows: SortRow[]; initial?: string; initialDesc?: boolean; minWidth?: number }) {
  const [by, setBy] = useState(initial || cols[0].key);
  const [desc, setDesc] = useState(initialDesc);
  const sorted = [...rows].sort((a, b) => {
    const x = a.cells[by]?.sort ?? null, y = b.cells[by]?.sort ?? null;
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return desc ? -c : c;
  });
  const click = (k: string) => { if (k === by) setDesc(!desc); else { setBy(k); setDesc(false); } };
  return (
    <div className="card scroll" style={{ padding: 0 }}>
      <table className="t" style={{ minWidth }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c.key} aria-sort={by === c.key ? (desc ? "descending" : "ascending") : "none"}
                style={{ textAlign: c.align || "left", paddingLeft: i === 0 ? 20 : undefined }}>
                <button type="button" onClick={() => click(c.key)} className="sort-btn" style={{ justifyContent: c.align === "right" ? "flex-end" : "flex-start" }}>
                  {c.label}<span aria-hidden="true" style={{ opacity: by === c.key ? 1 : 0.3 }}>{by === c.key ? (desc ? "↓" : "↑") : "↕"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              {cols.map((c, i) => {
                const v = r.cells[c.key];
                return (
                  <td key={c.key} style={{ textAlign: c.align || "left", paddingLeft: i === 0 ? 20 : undefined, background: v?.bg, fontWeight: v?.bg ? 700 : undefined }}>
                    {v?.href ? <Link href={v.href} style={{ fontWeight: 600 }}>{v.text}</Link>
                      : <span className={v?.muted ? "muted" : undefined}>{v?.text ?? "—"}</span>}
                    {v?.sub && <div className="tiny muted">{v.sub}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
