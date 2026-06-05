import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { Lightbulb } from "lucide-react";
import { DifficultyBadge, DifficultyLevel } from "./DifficultyBadge";

interface ArchitectureGuidanceCardProps {
  moduleName: string;
  description: string;
  level: DifficultyLevel;
}

export function ArchitectureGuidanceCard({
  moduleName,
  description,
  level,
}: ArchitectureGuidanceCardProps) {
  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm">Architecture guidance</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Common architecture concept for <span className="font-medium">{moduleName}</span>.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          <DifficultyBadge level={level} />
        </div>
      </CardContent>
    </Card>
  );
}
