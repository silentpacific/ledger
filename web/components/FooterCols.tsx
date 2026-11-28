"use client";
import Link from "next/link";
import { useState } from "react";

/** Footer link columns. Wide screens show every column; phones show each as a block that opens on tap. */
export default function FooterCols({ cols }: { cols: { title: string; links: [string, string][] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="ft-in ft-cols">
      {cols.map((c) => {
        const on = open === c.title, id = `ft-${c.title.toLowerCase()}`;
        return (
          <nav key={c.title} aria-label={c.title} className={on ? "ft-col on" : "ft-col"}>
            <button type="button" className="ft-h" aria-expanded={on} aria-controls={id} onClick={() => setOpen(on ? null : c.title)}>{c.title}</button>
            <div id={id} className="ft-list">{c.links.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}</div>
          </nav>
        );
      })}
    </div>
  );
}
