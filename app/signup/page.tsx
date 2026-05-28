import Signup from "@/pages/Signup";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function SignupPage() {
  return <Signup />;
}
