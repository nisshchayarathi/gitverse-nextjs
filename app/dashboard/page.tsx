import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
