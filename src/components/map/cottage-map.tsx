"use client";

import { useEffect, useRef, useState } from "react";
import panzoom from "panzoom";
import { PlaceholderSvg } from "@/components/map/placeholder-svg";
import {
  CottageDetailPanel,
  type CottageDetailData,
  type HouseholdOption,
} from "@/components/map/cottage-detail-panel";

export function CottageMap({
  cottages,
  householdOptions,
  isAdminViewer,
}: {
  cottages: CottageDetailData[];
  householdOptions: HouseholdOption[];
  isAdminViewer: boolean;
}) {
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

  const selectedCottage = selectedMapElementId
    ? cottages.find((c) => c.map_element_id === selectedMapElementId)
    : null;

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-md border border-border bg-muted/20">
      <div ref={panzoomTargetRef} className="h-full w-full">
        <PlaceholderSvg onClick={handleSvgClick} />
      </div>

      {selectedMapElementId && !selectedCottage ? (
        <div className="absolute right-4 top-4 z-10 w-80 max-w-[90vw] rounded-md border border-border bg-background p-4 text-sm shadow-lg">
          <p>
            This cottage isn&apos;t linked to data yet — run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              pnpm seed-cottages
            </code>{" "}
            to add it.
          </p>
          <button
            type="button"
            onClick={() => setSelectedMapElementId(null)}
            className="mt-3 text-xs text-muted-foreground underline"
          >
            Close
          </button>
        </div>
      ) : null}

      {selectedCottage ? (
        <CottageDetailPanel
          cottage={selectedCottage}
          householdOptions={householdOptions}
          isAdminViewer={isAdminViewer}
          onClose={() => setSelectedMapElementId(null)}
        />
      ) : null}
    </div>
  );
}
