import { Metadata } from "next";
import AnalysisJobClient from "./AnalysisJobClient";

export const metadata: Metadata = {
  title: "Repository Analysis",
};

export default function AnalysisJobPage({ params }: { params: { jobId: string } }) {
  return <AnalysisJobClient jobId={params.jobId} />;
}
