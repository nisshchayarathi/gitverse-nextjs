import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card } from "@/components/ui";

interface CommitData {
  date: string;
  count: number;
  day: number;
  hour: number;
}

interface CommitActivityHeatmapProps {
  repository?: any;
}

// Generate commit activity data from repository commits
const generateCommitData = (commits: any[], now: Date): CommitData[] => {
  const data: CommitData[] = [];
  const commitsByDate = new Map<string, number>();

  // Count commits by date
  commits?.forEach((commit: any) => {
    const date = new Date(commit.committedAt || commit.createdAt);
    const dateStr = date.toISOString().split("T")[0];
    commitsByDate.set(dateStr, (commitsByDate.get(dateStr) || 0) + 1);
  });

  // Fill in the last 52 weeks
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (week * 7 + (6 - day)));
      const dateStr = date.toISOString().split("T")[0];

      data.push({
        date: dateStr,
        count: commitsByDate.get(dateStr) || 0,
        day,
        hour: 12, // Default hour
      });
    }
  }

  return data;
};

export function CommitActivityHeatmap({
  repository,
}: CommitActivityHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<{
    date: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    // Advance the window automatically as time passes (refresh at next local midnight).
    const scheduleNextTick = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 1, 0);
      const msUntilNextMidnight = nextMidnight.getTime() - Date.now();
      return window.setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, msUntilNextMidnight);
    };

    const timeoutId = scheduleNextTick();
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const data = generateCommitData(repository?.commits || [], now);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 40, bottom: 30, left: 60 };
    const containerWidth = svgRef.current?.parentElement?.clientWidth || 1200;
    const width = Math.max(
      containerWidth - margin.left - margin.right,
      900 - margin.left - margin.right
    );
    const height = 200 - margin.top - margin.bottom;

    svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group data by week and day
    const weeksData = d3.group(data, (d) => {
      const date = new Date(d.date);
      const weekNum = Math.floor(
        (now.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      return weekNum;
    });

    const weeks = Array.from(weeksData.keys())
      .sort((a, b) => b - a)
      .slice(0, 52);
    const cellSize = Math.min(width / 52, 15);
    const cellPadding = 2;

    // Color scale
    const maxCount = d3.max(data, (d) => d.count) || 10;
    const colorScale = d3
      .scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateBlues);

    // Days labels
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    g.selectAll(".day-label")
      .data(days)
      .enter()
      .append("text")
      .attr("class", "day-label")
      .attr("x", -10)
      .attr("y", (_d, i) => i * (cellSize + cellPadding) + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "10px")
      .text((d) => d);

    // Month labels - derived from the rolling 52-week window
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Collect month label positions (keep unique month+year, so labels slide forward over time)
    const monthPositions: Array<{ month: string; x: number; fullDate: Date }> =
      [];
    const seenMonthKeys = new Set<string>();

    weeks.forEach((weekNum, weekIndex) => {
      const weekData = weeksData.get(weekNum) || [];
      if (weekData.length > 0) {
        const firstDate = new Date(weekData[0].date);
        const monthIndex = firstDate.getMonth();
        const monthName = months[monthIndex];
        const xPosition = (51 - weekIndex) * (cellSize + cellPadding);

        const monthKey = `${firstDate.getFullYear()}-${monthIndex}`;

        if (seenMonthKeys.has(monthKey)) return;
        seenMonthKeys.add(monthKey);

        monthPositions.push({
          month: monthName,
          x: xPosition,
          fullDate: firstDate,
        });
      }
    });

    // Sort by x-position (left to right)
    monthPositions.sort((a, b) => a.x - b.x);

    // Draw month labels
    monthPositions.forEach(({ month, x }) => {
      g.append("text")
        .attr("class", "month-label")
        .attr("x", x)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .attr("font-size", "10px")
        .text(month);
    });

    // Draw cells
    weeks.forEach((weekNum, weekIndex) => {
      const weekData = weeksData.get(weekNum) || [];

      weekData.forEach((d) => {
        const cell = g
          .append("rect")
          .attr("x", (51 - weekIndex) * (cellSize + cellPadding))
          .attr("y", d.day * (cellSize + cellPadding))
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("rx", 2)
          .attr(
            "fill",
            d.count === 0 ? "rgba(255,255,255,0.1)" : colorScale(d.count)
          )
          .attr("stroke", "rgba(0,0,0,0.5)")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("click", function (event) {
            event.stopPropagation();
            setSelectedDate({ date: d.date, count: d.count });
          })
          .on("mouseenter", function (event) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("stroke", "rgba(255,255,255,0.5)")
              .attr("stroke-width", 2);

            if (tooltipRef.current) {
              const tooltip = d3.select(tooltipRef.current);
              const formattedDate = new Date(d.date).toLocaleDateString(
                "en-US",
                {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }
              );
              tooltip.html(`
                <div class="space-y-1">
                  <div class="font-semibold text-sm">${formattedDate}</div>
                  <div class="text-xs">${d.count} ${d.count === 1 ? "commit" : "commits"}</div>
                </div>
              `);
              tooltip
                .style("opacity", "1")
                .style("display", "block")
                .style("left", `${event.clientX}px`)
                .style("top", `${event.clientY}px`);
            }
          })
          .on("mousemove", function (event) {
            if (tooltipRef.current) {
              d3.select(tooltipRef.current)
                .style("left", `${event.clientX}px`)
                .style("top", `${event.clientY}px`);
            }
          })
          .on("mouseleave", function () {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("stroke", "rgba(0,0,0,0.5)")
              .attr("stroke-width", 1);

            if (tooltipRef.current) {
              d3.select(tooltipRef.current)
                .style("opacity", "0")
                .style("display", "none");
            }
          });

        // Animate cells on load
        cell
          .attr("opacity", 0)
          .transition()
          .duration(500)
          .delay(weekIndex * 10 + d.day * 20)
          .attr("opacity", 1);
      });
    });

    // Legend
    const legendWidth = 150;
    const legendHeight = 15;
    const legend = g
      .append("g")
      .attr("transform", `translate(0, ${height + 20})`);

    const legendScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(5)
      .tickFormat((d) => `${d}`);

    // Gradient for legend
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    gradient
      .selectAll("stop")
      .data(d3.range(0, 1.1, 0.1))
      .enter()
      .append("stop")
      .attr("offset", (d) => `${d * 100}%`)
      .attr("stop-color", (d) => colorScale(d * maxCount));

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    legend
      .append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .attr("color", "currentColor")
      .selectAll("text")
      .attr("font-size", "10px");

    legend
      .append("text")
      .attr("x", -10)
      .attr("y", legendHeight / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "10px")
      .text("Less");

    legend
      .append("text")
      .attr("x", legendWidth + 10)
      .attr("y", legendHeight / 2)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .attr("fill", "currentColor")
      .attr("font-size", "10px")
      .text("More");
  }, [repository, now]);

  // Get commits for selected date
  const getCommitsForDate = (date: string) => {
    return (
      repository?.commits?.filter((commit: any) => {
        const commitDate = new Date(commit.committedAt || commit.createdAt)
          .toISOString()
          .split("T")[0];
        return commitDate === date;
      }) || []
    );
  };

  const selectedCommits = selectedDate
    ? getCommitsForDate(selectedDate.date)
    : [];

  return (
    <Card className="glass p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold">Commit Activity</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Contribution activity over the last 52 weeks
        </p>
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <svg
          ref={svgRef}
          width={`${Math.max(1200, svgRef.current?.parentElement?.clientWidth || 900)}`}
          height="250"
          className="text-foreground"
          style={{ minWidth: "100%", height: "auto" }}
        />
      </div>

      {/* Selected Date Detail */}
      {selectedDate && selectedDate.count > 0 && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 glass rounded-lg border border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm sm:text-base truncate">
                {new Date(selectedDate.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {selectedDate.count}{" "}
                {selectedDate.count === 1 ? "commit" : "commits"}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
            {selectedCommits.map((commit: any) => (
              <div
                key={commit.id}
                className="p-2 sm:p-3 bg-background/30 rounded border border-border/30 hover:border-border/60 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium break-words">
                      {commit.message}
                    </p>
                    <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="truncate">{commit.authorName}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="font-mono">{commit.shortHash}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        {new Date(commit.committedAt).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                  {commit.additions > 0 || commit.deletions > 0 ? (
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {commit.additions > 0 && (
                        <span className="text-green-400">
                          +{commit.additions}
                        </span>
                      )}
                      {commit.deletions > 0 && (
                        <span className="text-red-400">
                          -{commit.deletions}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

<div
  ref={tooltipRef}
  className="
    fixed p-3 rounded-lg pointer-events-none shadow-xl border
    translate-x-[-100px] translate-y-[-200px]
    sm:translate-x-[-350px] sm:translate-y-[-320px]
  "
  style={{
    opacity: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    color: "white",
    zIndex: 9999,
    backdropFilter: "blur(8px)",
    left: "0px",
    top: "0px",
    whiteSpace: "nowrap",
  }}
/>

    </Card>
  );
}
