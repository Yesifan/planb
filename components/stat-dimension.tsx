"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type Dimension = {
  name: string;
  value: number;
  summary: string;
};

const chartSize = 200;
const chartCenter = chartSize / 2;
const chartRadius = 67;
const labelRadius = 88;
const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];

function getPoint(index: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;

  return {
    x: chartCenter + radius * Math.cos(angle),
    y: chartCenter + radius * Math.sin(angle),
  };
}

function getPoints(dimensions: Dimension[]) {
  return dimensions
    .map((dimension, index) => {
      const value = Math.min(100, Math.max(0, dimension.value));
      return getPoint(index, chartRadius * (value / 100));
    })
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

function getGridPoints(level: number) {
  return Array.from({ length: 5 })
    .map((_, index) => getPoint(index, chartRadius * level))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function StatDimension({ dimensions }: { dimensions: Dimension[] }) {
  const [selectedName, setSelectedName] = useState(dimensions[0]?.name);
  const selectedDimension =
    dimensions.find((dimension) => dimension.name === selectedName) ??
    dimensions[0];
  const polygonPoints = useMemo(() => getPoints(dimensions), [dimensions]);

  if (!selectedDimension) {
    return null;
  }

  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar/60 px-3 py-3">
      <div className="relative mx-auto aspect-square w-full max-w-[240px]">
        <svg
          viewBox={`0 0 ${chartSize} ${chartSize}`}
          className="size-full"
          role="img"
          aria-label="主角五维雷达图"
        >
          {gridLevels.map((level) => (
            <polygon
              key={level}
              points={getGridPoints(level)}
              className="fill-none stroke-sidebar-border/70"
              strokeWidth="1"
            />
          ))}
          {dimensions.map((dimension, index) => {
            const point = getPoint(index, chartRadius);
            return (
              <line
                key={dimension.name}
                x1={chartCenter}
                y1={chartCenter}
                x2={point.x}
                y2={point.y}
                className="stroke-sidebar-border/70"
                strokeWidth="1"
              />
            );
          })}
          <polygon
            points={polygonPoints}
            className="fill-accent/20 stroke-accent"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {dimensions.map((dimension, index) => {
            const value = Math.min(100, Math.max(0, dimension.value));
            const point = getPoint(index, chartRadius * (value / 100));
            return (
              <circle
                key={dimension.name}
                cx={point.x}
                cy={point.y}
                r={selectedDimension.name === dimension.name ? 4 : 3}
                className="fill-accent transition-[r] duration-200 motion-reduce:transition-none"
              />
            );
          })}
        </svg>
        {dimensions.map((dimension, index) => {
          const point = getPoint(index, labelRadius);
          const isSelected = selectedDimension.name === dimension.name;

          return (
            <button
              key={dimension.name}
              type="button"
              className={cn(
                "absolute min-w-12 -translate-x-1/2 -translate-y-1/2 rounded-lg px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors duration-200 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar motion-reduce:transition-none",
                isSelected && "bg-accent/10 text-accent",
              )}
              style={{
                left: `${(point.x / chartSize) * 100}%`,
                top: `${(point.y / chartSize) * 100}%`,
              }}
              aria-pressed={isSelected}
              onClick={() => setSelectedName(dimension.name)}
            >
              {dimension.name}
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-lg border border-sidebar-border/70 bg-background/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm font-medium">
            {selectedDimension.name}
          </div>
          <span className="font-mono text-lg leading-none font-semibold tabular-nums">
            {Math.min(100, Math.max(0, selectedDimension.value))}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {selectedDimension.summary}
        </p>
      </div>
    </div>
  );
}
