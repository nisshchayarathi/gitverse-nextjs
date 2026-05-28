import Login from "@/pages/Login";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In",
};

export default function LoginPage() {
  return <Login />;
}
