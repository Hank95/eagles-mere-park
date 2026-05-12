import { SignOutButton } from "@/components/auth/sign-out-button";

export default function NoHouseholdPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere Park
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          You&apos;re not in any household yet
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Reach out to a Park board member to get added to the directory.
          They&apos;ll set up your cottage and family, and you can come back
          here.
        </p>
        <div className="pt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
