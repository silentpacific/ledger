"use client";
import { useRouter } from "next/navigation";
import { useId } from "react";

/** A compact dropdown filter that applies on change and keeps the reader's place on the page. */
export default function FilterSelect({ label, param, value, options, path, query, reset = [], width = 220 }: {
  label: string; param: string; value?: string; options: { value: string; label: string }[];
  path: string; query: Record<string, string | undefined>; reset?: string[]; width?: number;
}) {
  const router = useRouter();
  const id = useId();
  const go = (v: string) => {
    const next: Record<string, string | undefined> = { ...query, [param]: v || undefined };
    reset.forEach((k) => (next[k] = undefined));
    const p = new URLSearchParams(Object.entries(next).filter(([, x]) => x) as [string, string][]).toString();
    router.push(p ? `${path}?${p}` : path, { scroll: false });
  };
  return (
    <span className="fsel">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ""} onChange={(e) => go(e.target.value)} style={{ width }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  );
}
