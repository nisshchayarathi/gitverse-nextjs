"use client";

import { Suspense } from "react";
import ResetPassword from "@/pages/ResetPassword";

// Wrap in Suspense because ResetPassword uses useSearchParams()
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
