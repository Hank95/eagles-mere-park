"use client";

import { useEffect, useRef } from "react";
import {
  type CottageDetailData,
  type HouseholdOption,
} from "@/components/map/cottage-detail-panel";
import { CottageEditFields } from "@/components/map/cottage-edit-fields";

export function CottagePopover({
  cottage,
  householdOptions,
  isAdminViewer,
  onClose,
}: {
  cottage: CottageDetailData;
  householdOptions: HouseholdOption[];
  isAdminViewer: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`${cottage.name} details`}
      className="absolute right-4 top-4 z-10 w-80 max-w-[90vw] space-y-3 rounded-md border border-border bg-background p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{cottage.name}</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 text-sm">
        {cottage.linkedHousehold ? (
          <p>
            <span className="text-muted-foreground">Household:</span>{" "}
            <a
              href={`/households/${cottage.linkedHousehold.id}`}
              className="underline underline-offset-2"
            >
              {cottage.linkedHousehold.familyLastNames || cottage.linkedHousehold.cottage_name}
            </a>
          </p>
        ) : (
          <p className="italic text-muted-foreground">Currently vacant.</p>
        )}

        {cottage.year_built ? (
          <p>
            <span className="text-muted-foreground">Built:</span>{" "}
            {cottage.year_built}
          </p>
        ) : null}

        {cottage.history_text ? (
          <p className="whitespace-pre-line text-muted-foreground">
            {cottage.history_text}
          </p>
        ) : null}
      </div>

      {isAdminViewer ? (
        <CottageEditFields cottage={cottage} householdOptions={householdOptions} />
      ) : null}
    </div>
  );
}
