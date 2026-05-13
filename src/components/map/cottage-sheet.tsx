"use client";

import { useEffect } from "react";
import type {
  CottageDetailData,
  HouseholdOption,
} from "@/components/map/cottage-detail-panel";

export function CottageSheet({
  cottage,
  householdOptions: _householdOptions,
  isAdminViewer: _isAdminViewer,
  onClose,
}: {
  cottage: CottageDetailData;
  householdOptions: HouseholdOption[];
  isAdminViewer: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close cottage details"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-label={`${cottage.name} details`}
        className="relative max-h-[60vh] space-y-3 overflow-y-auto rounded-t-xl border-t border-border bg-background p-5 shadow-lg"
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-border" />

        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{cottage.name}</h2>
          <button
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
      </div>
    </div>
  );
}
