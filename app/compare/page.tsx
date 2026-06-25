'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CompareRepositories from '@/pages/Compare';

export default function ComparePage() {
  return (
    <ProtectedRoute>
      <CompareRepositories />
    </ProtectedRoute>
  );
}
