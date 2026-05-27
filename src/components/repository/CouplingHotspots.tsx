"use client";

import { Card } from "@/components/ui";

interface Props {
  hotspots: {
    name: string;
    lines: number;
  }[];
}

export function CouplingHotspots({
  hotspots,
}: Props) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">
        Coupling Hotspots
      </h2>

      <div className="space-y-3">
        {hotspots.map((spot, index) => (
          <div
            key={index}
            className="flex items-center justify-between border rounded-lg p-3"
          >
            <span className="truncate">
              {spot.name}
            </span>

            <span className="font-semibold">
              {spot.lines} LOC
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}