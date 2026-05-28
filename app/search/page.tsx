import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import SearchPage from "@/pages/SearchPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
};

export default function Search() {
  return (
    <ProtectedRoute>
      <SearchPage />
    </ProtectedRoute>
  );
}
