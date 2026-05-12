"use client";

import type { Database } from "@/lib/database.types";

export type MemberFormRow = Database["public"]["Tables"]["members"]["Row"];

export function MemberEditRow({ member }: { member: MemberFormRow }) {
  const prefix = `member.${member.id}.`;

  return (
    <li className="rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}name`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Name
          </label>
          <input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={member.name}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}role`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Role
          </label>
          <input
            id={`${prefix}role`}
            name={`${prefix}role`}
            defaultValue={member.role ?? ""}
            placeholder="year-round / summer / extended family"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}email`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Email
          </label>
          <input
            id={`${prefix}email`}
            name={`${prefix}email`}
            type="email"
            defaultValue={member.email ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}phone`}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Phone
          </label>
          <input
            id={`${prefix}phone`}
            name={`${prefix}phone`}
            type="tel"
            defaultValue={member.phone ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Privacy toggles for the contact fields land in the next iteration.
      </p>
    </li>
  );
}
