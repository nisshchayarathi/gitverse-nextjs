"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Badge, Skeleton } from "@/components/ui";
import { buildApiUrl } from "@/services/apiConfig";

interface TechStackListProps {
  repositoryId: string | number;
}

const TECH_COLOR_MAP: Record<string, string> = {
  TypeScript: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
  React: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20",
  "Next.js": "bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700",
  "Tailwind CSS": "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20",
  Prisma: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20",
  Express: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
  Vue: "bg-emerald-600/10 text-emerald-400 border-emerald-600/20 hover:bg-emerald-600/20",
  Angular: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
  MongoDB: "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20",
  NestJS: "bg-red-600/10 text-red-400 border-red-600/20 hover:bg-red-600/20",
  Svelte: "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
  Vite: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
  Redux: "bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20",
  Astro: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
  GraphQL: "bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20",
};

export function TechStackList({ repositoryId }: TechStackListProps) {
  const [techStack, setTechStack] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchTechStack() {
      if (!repositoryId) return;
      setLoading(true);
      try {
        const token = localStorage.getItem("gitverse_token");
        const response = await axios.get(
          buildApiUrl(`/api/repositories/${repositoryId}/tech-stack`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (active) {
          setTechStack(response.data.techStack || []);
        }
      } catch (err) {
        if (active) {
          console.error("Error fetching tech stack:", err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchTechStack();
    return () => {
      active = false;
    };
  }, [repositoryId]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 items-center min-h-[28px] animate-pulse">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Tech Stack:</span>
        <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
        <Skeleton className="h-5 w-20 rounded-full bg-white/5" />
        <Skeleton className="h-5 w-24 rounded-full bg-white/5" />
      </div>
    );
  }

  if (techStack.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
      <span className="text-xs font-semibold text-muted-foreground mr-1">Tech Stack:</span>
      {techStack.map((tech) => {
        const customClasses = TECH_COLOR_MAP[tech] || "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20";
        return (
          <Badge
            key={tech}
            className={`px-2.5 py-0.5 text-xs font-medium border cursor-default transform hover:scale-105 transition-all duration-300 ${customClasses}`}
          >
            {tech}
          </Badge>
        );
      })}
    </div>
  );
}
