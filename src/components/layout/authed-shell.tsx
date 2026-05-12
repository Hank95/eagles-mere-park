import { SignOutButton } from "@/components/auth/sign-out-button";

export function AuthedShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a
            href="/dashboard"
            className="text-sm font-semibold tracking-tight"
          >
            Eagles Mere Park
          </a>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-muted-foreground">
          Eagles Mere Park — members only
        </div>
      </footer>
    </div>
  );
}
