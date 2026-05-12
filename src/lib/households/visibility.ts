import type { Database } from "@/lib/database.types";

export type HouseholdRow = Database["public"]["Tables"]["households"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export type ViewerContext = {
  id: string;
  isAdmin: boolean;
  householdId: string | null;
};

export type VisibleMember = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
};

export function filterMemberForViewer(
  member: MemberRow,
  viewer: ViewerContext,
): VisibleMember {
  const sameHousehold = viewer.householdId === member.household_id;
  const isSelf = viewer.id === member.user_id;
  const see = (publicFlag: boolean) =>
    publicFlag || viewer.isAdmin || sameHousehold || isSelf;

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    email: see(member.email_is_public) ? member.email : null,
    phone: see(member.phone_is_public) ? member.phone : null,
  };
}

export function shouldShowAddress(
  household: HouseholdRow & { members: MemberRow[] },
  viewer: ViewerContext,
): boolean {
  if (viewer.isAdmin) return true;
  if (viewer.householdId === household.id) return true;
  return household.members.some((m) => m.address_is_public);
}
