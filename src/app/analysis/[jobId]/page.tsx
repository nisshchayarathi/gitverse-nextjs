"use client";

import { useRouter } from "next/navigation";

export default function AnalysisJobPage() {
  const router = useRouter();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      textAlign: "center",
      padding: "2rem"
    }}>
      <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        No Analysis Jobs Found
      </h2>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        You haven't created any analysis jobs yet.
      </p>
      <button
        onClick={() => router.push("/analyze")}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1.5rem",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem"
        }}
      >
        + Create New Job
      </button>
    </div>
  );
}
