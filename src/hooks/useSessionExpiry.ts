"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/sessionConstants";
import { removeAuthToken } from "@/lib/authTokenStorage";

export function useSessionExpiry() {
  const { status } = useSession();
  const router = useRouter();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      wasAuthenticated.current = true;
    }

    if (status === "unauthenticated" && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      if (typeof window !== "undefined") {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("session-expired", {
          detail: { message: SESSION_EXPIRED_MESSAGE },
        }));
      }
      router.push("/login");
    }
  }, [status, router]);
}
