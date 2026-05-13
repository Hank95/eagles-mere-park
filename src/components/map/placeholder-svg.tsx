import { forwardRef, type SVGProps } from "react";
import { PLACEHOLDER_COTTAGES } from "@/lib/cottages/placeholder";

export const PlaceholderSvg = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function PlaceholderSvg(props, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 600 400"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        {...props}
      >
        {/* Lake silhouette */}
        <rect
          x="50"
          y="180"
          width="500"
          height="100"
          rx="40"
          className="fill-sky-100"
        />
        <text
          x="300"
          y="235"
          textAnchor="middle"
          className="pointer-events-none fill-sky-700 text-[14px] italic"
        >
          Eagles Mere
        </text>

        {/* Cottages — each <g> carries data-cottage-id for click delegation */}
        {PLACEHOLDER_COTTAGES.map((c) => (
          <g key={c.id} data-cottage-id={c.id} className="cursor-pointer">
            <rect
              x={c.x}
              y={c.y}
              width={50}
              height={36}
              rx={4}
              className="fill-amber-50 stroke-amber-700 transition-colors hover:fill-amber-200"
              strokeWidth={1}
            />
            <text
              x={c.x + 25}
              y={c.y + 22}
              textAnchor="middle"
              className="pointer-events-none fill-amber-900 text-[10px] font-medium"
            >
              {c.name.replace("Cottage ", "")}
            </text>
          </g>
        ))}
      </svg>
    );
  },
);
