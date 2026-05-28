import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Contribute from "@/pages/Contribute";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contribute",
};

export default function ContributePage() {
  return (
    <ProtectedRoute>
      <Contribute />
    </ProtectedRoute>
  );
}
