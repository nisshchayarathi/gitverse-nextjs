import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Settings from "@/pages/Settings";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  );
}
