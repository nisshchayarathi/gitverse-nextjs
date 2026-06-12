"use client";

import { useEffect } from "react";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { useToast } from "@/hooks/use-toast";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/sessionConstants";

export function SessionExpiryHandler() {
  useSessionExpiry();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const detail = e.detail;
      toast({
        title: "Session Expired",
        description: detail?.message ?? SESSION_EXPIRED_MESSAGE,
        variant: "destructive",
      });
    };
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, [toast]);

  return null;
}
