"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/services/apiConfig";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Target, AlertTriangle, Lightbulb, RefreshCw, Layers, ShieldAlert, Sparkles } from "lucide-react";

interface ModuleDifficulty {
  name: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  reason: string;
  entryPoints: string[];
}

interface Hotspot {
  name: string;
  riskLevel: "Low" | "Medium" | "High";
  description: string;
}

interface ContributorData {
  modules: ModuleDifficulty[];
  hotspots: Hotspot[];
}

export const ContributorGuide = ({ repositoryData }: { repositoryData: any }) => {
  const [data, setData] = useState<ContributorData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAnalysis = async () => {
    if (!repositoryData?.id) return;
    setLoading(true);
    
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.post(
        buildApiUrl("/api/ai/analyze-repository"),
        {
          repositoryId: Number(repositoryData.id),
          type: "contribution-difficulty",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      let analysisText = response.data.analysis || "";
      // Remove optional markdown json fences and surrounding whitespace
      analysisText = analysisText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      const parsedData = JSON.parse(analysisText);
      if (!parsedData || !Array.isArray(parsedData.modules) || !Array.isArray(parsedData.hotspots)) {
        throw new Error("Invalid response structure from AI.");
      }

      setData({
        modules: parsedData.modules,
        hotspots: parsedData.hotspots
      });
    } catch (error: any) {
      console.error("Failed to load contributor guide:", error);
      toast({
        title: "Analysis Failed",
        description: error.response?.data?.error || "Could not generate contributor guide.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryData?.id) {
      fetchAnalysis();
    }
  }, [repositoryData?.id]);

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "Beginner": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "Intermediate": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Advanced": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Low": return "text-emerald-500";
      case "Medium": return "text-amber-500";
      case "High": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-lg p-12 text-center space-y-4 animate-pulse">
        <div className="flex justify-center">
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="font-semibold text-lg">Analyzing Contribution Difficulty...</h3>
        <p className="text-sm text-muted-foreground">
          Our AI is evaluating the repository structure, identifying hotspots, and generating entry points.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass rounded-lg p-12 text-center space-y-4">
        <div className="flex justify-center">
          <Target className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <h3 className="font-semibold text-lg">Contributor Guide</h3>
        <p className="text-sm text-muted-foreground">
          Discover beginner-friendly modules, entry points, and high-risk hotspots using AI.
        </p>
        <button
          onClick={fetchAnalysis}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Generate Guide
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 glass rounded-xl flex flex-col md:flex-row gap-6 items-center justify-between bg-gradient-to-br from-background to-primary/5 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="z-10">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Sparkles className="text-primary w-6 h-6" />
            AI Contributor Guide
          </h2>
          <p className="text-muted-foreground">
            Explore carefully curated entry points tailored to different experience levels. 
            Review the hotspots before jumping into complex architectural areas.
          </p>
        </div>
        <button
          onClick={fetchAnalysis}
          className="z-10 px-4 py-2 flex items-center gap-2 glass hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-border/50"
        >
          <RefreshCw className="w-4 h-4" /> Regenerate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules Section */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" /> Modules & Entry Points
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.modules.map((mod, idx) => (
              <Card key={idx} className="glass glass-hover h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-base font-semibold truncate" title={mod.name}>
                      {mod.name}
                    </CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getDifficultyColor(mod.difficulty)}`}>
                      {mod.difficulty}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    {mod.reason}
                  </p>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-yellow-500" /> Suggested Entry Points
                    </h4>
                    <ul className="space-y-1.5">
                      {mod.entryPoints.map((ep, i) => (
                         <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                           <span className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                           <span className="break-words">{ep}</span>
                         </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Hotspots Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Hotspots & Risks
          </h3>
          <div className="space-y-4">
            {data.hotspots.length === 0 ? (
              <div className="glass rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground">No critical hotspots identified.</p>
              </div>
            ) : (
              data.hotspots.map((hotspot, idx) => (
                <div key={idx} className="glass rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className={`w-4 h-4 ${getRiskColor(hotspot.riskLevel)}`} />
                    <h4 className="font-semibold text-sm truncate" title={hotspot.name}>
                      {hotspot.name}
                    </h4>
                  </div>
                  <span className={`text-xs font-medium ${getRiskColor(hotspot.riskLevel)}`}>
                    {hotspot.riskLevel} Risk
                  </span>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {hotspot.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
