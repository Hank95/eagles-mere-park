"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  type ResetRequestState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state?.sent) {
    return (
      <p className="rounded-md border border-input bg-muted px-4 py-3 text-sm">
        If an account exists for that email, a reset link is on its way. Check
        your inbox.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
