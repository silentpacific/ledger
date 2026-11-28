"use client";
import { useState } from "react";

/** A greyed-out button for a feature that isn't built yet: hover or tap shows when it's coming. */
export default function ComingSoon({ label, note = "Coming early 2027" }: { label: string; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="cs" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-disabled="true" aria-describedby="cs-note" className="cs-btn" onClick={() => setOpen((x) => !x)} onBlur={() => setOpen(false)}>
        <svg width="13" height="15" viewBox="0 0 16 18" aria-hidden="true"><rect x="1" y="8" width="14" height="9" rx="2" fill="#94A3B8" /><path d="M4 8V5a4 4 0 0 1 8 0v3" fill="none" stroke="#94A3B8" strokeWidth="2" /></svg>
        {label}
      </button>
      <span id="cs-note" role="tooltip" className={open ? "cs-tip on" : "cs-tip"}>{note}</span>
    </span>
  );
}
