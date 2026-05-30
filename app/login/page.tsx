import Login from "@/pages/Login";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Log In",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
