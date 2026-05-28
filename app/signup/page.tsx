import { Suspense } from "react";
import Signup from "@/pages/Signup";

export const dynamic = "force-dynamic";

function SignupWrapper() {
  return <Signup />;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupWrapper />
    </Suspense>
  );
}