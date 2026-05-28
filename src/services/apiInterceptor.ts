"use client";

import axios from "axios";
import { toast } from "@/hooks/use-toast";

let isInitialized = false;
const lastToasts = new Map<string, number>();
const DEBOUNCE_MS = 1500; // 1.5 seconds de-duplication window

/**
 * Helper to display de-duplicated toast notifications
 */
export const showToast = (
  title: string,
  description: string,
  variant: "default" | "destructive" = "default"
) => {
  const key = `${title}:${description}`;
  const now = Date.now();
  const lastTime = lastToasts.get(key);

  if (lastTime && now - lastTime < DEBOUNCE_MS) {
    return;
  }

  lastToasts.set(key, now);

  toast({
    title,
    description,
    variant,
  });
};

/**
 * Initialize global Axios interceptors and Monkeypatch browser fetch
 */
export const initGlobalInterceptors = () => {
  if (isInitialized || typeof window === "undefined") {
    return;
  }
  isInitialized = true;

  // 1. Axios Response Interceptor
  axios.interceptors.response.use(
    (response) => {
      // Check for empty responses (200 OK or 204 No Content with null/empty body)
      if (response.status === 200 || response.status === 204) {
        if (
          response.data === null ||
          response.data === undefined ||
          response.data === ""
        ) {
          showToast(
            "Empty Response",
            "The server returned an empty response.",
            "default"
          );
        }
      }
      return response;
    },
    (error) => {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      const response = error.response;
      const status = response?.status;
      const errorData = response?.data;

      let title = "API Failure";
      let message = "An unexpected error occurred.";
      let variant: "default" | "destructive" = "destructive";

      if (!response) {
        // Network issue
        title = "Network Issue";
        message =
          "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (status === 401) {
        // Authentication failure
        title = "Session Expired";
        message = "Your session has expired. Please sign in again.";
        localStorage.removeItem("gitverse_token");
      } else if (status === 403) {
        // Forbidden/Access Denied
        title = "Access Denied";
        message =
          errorData?.error ||
          errorData?.message ||
          "You do not have permission to perform this action.";
      } else {
        // General API failures (400, 404, 500, etc.)
        title = `API Error (${status})`;
        message =
          errorData?.error ||
          errorData?.message ||
          error.message ||
          "Failed to complete request.";
      }

      showToast(title, message, variant);
      return Promise.reject(error);
    }
  );

  // 2. Fetch API Override
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const response = await originalFetch(...args);

      // Only intercept responses that might be internal APIs to avoid noise
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      const isInternalApi = url.includes("/api/");

      if (isInternalApi) {
        if (response.status === 401) {
          showToast(
            "Session Expired",
            "Your session has expired. Please sign in again.",
            "destructive"
          );
          localStorage.removeItem("gitverse_token");
        } else if (response.status === 403) {
          showToast(
            "Access Denied",
            "You do not have permission to perform this action.",
            "destructive"
          );
        } else if (!response.ok) {
          let errorMsg = "An error occurred during the request.";
          try {
            const clone = response.clone();
            const data = await clone.json();
            errorMsg = data.error || data.message || errorMsg;
          } catch {
            try {
              const clone = response.clone();
              const text = await clone.text();
              if (text && text.length < 150) {
                errorMsg = text;
              }
            } catch {}
          }
          showToast(`API Error (${response.status})`, errorMsg, "destructive");
        } else if (response.status === 200 || response.status === 204) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            if (text === null || text === undefined || text === "") {
              showToast(
                "Empty Response",
                "The server returned an empty response.",
                "default"
              );
            }
          } catch {}
        }
      }

      return response;
    } catch (error: any) {
      showToast(
        "Network Issue",
        "A network error occurred. Please check your internet connection.",
        "destructive"
      );
      throw error;
    }
  };
};
