"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Contribute from "@/pages/Contribute";

export default function ContributePage() {
  return (
    <ProtectedRoute>
      <Contribute />
    </ProtectedRoute>
  );
}
