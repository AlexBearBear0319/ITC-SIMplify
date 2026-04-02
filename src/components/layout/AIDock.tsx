"use client";

import { usePathname } from "next/navigation";
import { MorphPanel } from "@/components/ui/ai-input";

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

export default function AIDock() {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
      <MorphPanel />
    </div>
  );
}

