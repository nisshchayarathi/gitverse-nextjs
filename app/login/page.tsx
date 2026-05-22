'use client'

import Login from '@/pages/Login'
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
