import { Suspense } from "react";
import Login from "@/pages/Login";

export const dynamic = "force-dynamic";

function LoginWrapper() {
  return <Login />;
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginWrapper />
    </Suspense>
  );
}