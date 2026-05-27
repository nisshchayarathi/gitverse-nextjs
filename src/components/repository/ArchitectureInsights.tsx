import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

interface Insight {
  title: string;
  description: string;
  severity: string;
}

interface Props {
  insights: Insight[];
}

export function ArchitectureInsights({ insights }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Architecture Insights</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {insight.title}
                </h3>

                <span
                  className={`text-xs px-2 py-1 rounded ${
                    insight.severity === "high"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {insight.severity}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}