import type { Metadata } from "next";

export const metadata: Metadata = { title: "MOVEO Studio – Check-in", robots: { index: false } };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
