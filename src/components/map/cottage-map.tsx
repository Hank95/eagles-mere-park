"use client";

import { useEffect, useRef, useState } from "react";
import panzoom from "panzoom";
import { PlaceholderSvg } from "@/components/map/placeholder-svg";

export function CottageMap() {
  const panzoomTargetRef = useRef<HTMLDivElement>(null);
  const [selectedMapElementId, setSelectedMapElementId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const target = panzoomTargetRef.current;
    if (!target) return;

    const instance = panzoom(target, {
      maxZoom: 5,
      minZoom: 0.5,
      bounds: true,
      boundsPadding: 0.1,
    });

    return () => {
      instance.dispose();
    };
  }, []);

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const target = (e.target as Element).closest("[data-cottage-id]");
    if (!target) return;
    const id = target.getAttribute("data-cottage-id");
    if (id) setSelectedMapElementId(id);
  }

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-md border border-border bg-muted/20">
      <div ref={panzoomTargetRef} className="h-full w-full">
        <PlaceholderSvg onClick={handleSvgClick} />
      </div>

      {selectedMapElementId ? (
        <div className="absolute right-4 top-4 rounded-md border border-border bg-background px-3 py-2 text-sm shadow">
          Selected: {selectedMapElementId}
          <button
            type="button"
            onClick={() => setSelectedMapElementId(null)}
            className="ml-3 text-xs text-muted-foreground underline"
          >
            close
          </button>
        </div>
      ) : null}
    </div>
  );
}
