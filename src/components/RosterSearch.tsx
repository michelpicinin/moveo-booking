"use client";
import { useEffect, useState } from "react";

/** Filters the attendance list by name as you type. */
export function RosterSearch() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-name]").forEach((el) => {
      el.style.display = !needle || el.dataset.name!.includes(needle) ? "" : "none";
    });
  }, [q]);
  return <input type="search" placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search name" />;
}
