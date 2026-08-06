"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the current route every `intervalMs` while mounted. Rendered
 * only when an agent task is queued/running so results appear live. */
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
