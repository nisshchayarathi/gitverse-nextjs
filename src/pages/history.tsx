"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HistoryDashboard } from "@/components/HistoryDashboard";

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <HistoryDashboard />
    </DashboardLayout>
  );
}