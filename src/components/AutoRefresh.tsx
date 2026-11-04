"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page every few seconds, e.g. while waiting for the payment webhook. */
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
