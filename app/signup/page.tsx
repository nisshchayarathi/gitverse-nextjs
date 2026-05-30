import Signup from "@/pages/Signup";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Signup />
    </Suspense>
  );
}
