import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { DifficultyBadge, DifficultyLevel } from "./DifficultyBadge";
import { ArchitectureGuidanceCard } from "./ArchitectureGuidanceCard";

interface GuidanceProps {
  description: string;
  recommendation: string;
  difficulty: DifficultyLevel;
}

interface BeginnerGuidanceCardProps {
  moduleName: string;
  guidance: GuidanceProps;
  architectureDescription: string;
}

export function BeginnerGuidanceCard({
  moduleName,
  guidance,
  architectureDescription,
}: BeginnerGuidanceCardProps) {
  return (
    <Card className="glass border border-border/70 transition-all duration-300">
      <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">{moduleName}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {guidance.recommendation}
          </CardDescription>
        </div>
        <DifficultyBadge level={guidance.difficulty} />
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="space-y-2">
          <p className="text-sm leading-6 text-muted-foreground">
            {guidance.description}
          </p>
        </div>
        <ArchitectureGuidanceCard
          moduleName={moduleName}
          description={architectureDescription}
          level={guidance.difficulty}
        />
      </CardContent>
    </Card>
  );
}
