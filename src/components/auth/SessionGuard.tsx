"use client";

import React, { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings",
  "/repo",
  "/analysis",
  "/analyze",
  "/contribute"
];

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const hasAlerted = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    const isProtected = PROTECTED_ROUTES.some((route) =>
      pathname?.startsWith(route)
    );

    if (status === "unauthenticated" && isProtected) {
      if (!hasAlerted.current) {
        hasAlerted.current = true;
        
        toast({
          title: "Session Expired",
          description: "Session expired. Please log in again.",
          variant: "destructive",
        });

        // Clear local JWT token if any exists
        localStorage.removeItem("gitverse_token");
        
        // Redirect to login
        router.push(`/login?from=${encodeURIComponent(pathname || "/dashboard")}`);
      }
    } else if (status === "authenticated") {
      hasAlerted.current = false;
    }
  }, [status, pathname, router, toast]);

  return <>{children}</>;
}
