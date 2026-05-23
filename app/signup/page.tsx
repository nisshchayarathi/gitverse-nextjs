'use client'

import Signup from '@/pages/Signup'
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Signup />
    </Suspense>
  );
}
