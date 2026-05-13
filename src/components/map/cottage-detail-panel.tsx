"use client";

import { useMediaQuery } from "@/lib/use-media-query";
import { CottagePopover } from "@/components/map/cottage-popover";
import { CottageSheet } from "@/components/map/cottage-sheet";
import type { Database } from "@/lib/database.types";

type CottageRow = Database["public"]["Tables"]["cottages"]["Row"];

export type CottageDetailData = CottageRow & {
  linkedHousehold: {
    id: string;
    cottage_name: string;
    familyLastNames: string;
  } | null;
};

export type HouseholdOption = {
  id: string;
  label: string;
};

export function CottageDetailPanel({
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
  const desktop = useMediaQuery("(min-width: 768px)");

  if (desktop) {
    return (
      <CottagePopover
        cottage={cottage}
        householdOptions={householdOptions}
        isAdminViewer={isAdminViewer}
        onClose={onClose}
      />
    );
  }

  return (
    <CottageSheet
      cottage={cottage}
      householdOptions={householdOptions}
      isAdminViewer={isAdminViewer}
      onClose={onClose}
    />
  );
}
