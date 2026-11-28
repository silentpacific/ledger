"use client";
import { useEffect } from "react";

/** Closes the header's drop-down menus on a click outside, on Escape, and when another one opens. */
export default function MenuCloser() {
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>("details.hd-menu[open]")];
    const down = (e: PointerEvent) => menus().forEach((d) => { if (!d.contains(e.target as Node)) d.open = false; });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") menus().forEach((d) => { d.open = false; d.querySelector("summary")?.focus(); }); };
    const toggle = (e: Event) => { const t = e.target as HTMLDetailsElement; if (t.matches?.("details.hd-menu") && t.open) menus().forEach((d) => d !== t && (d.open = false)); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    document.addEventListener("toggle", toggle, true);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); document.removeEventListener("toggle", toggle, true); };
  }, []);
  return null;
}
