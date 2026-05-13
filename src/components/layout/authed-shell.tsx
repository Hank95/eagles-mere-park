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
          <div className="flex items-center gap-6">
            <a
              href="/dashboard"
              className="text-sm font-semibold tracking-tight"
            >
              Eagles Mere Park
            </a>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="/directory" className="hover:text-foreground">
                Directory
              </a>
              <a href="/events" className="hover:text-foreground">
                Events
              </a>
              <a href="/calendar" className="hover:text-foreground">
                Calendar
              </a>
            </nav>
          </div>
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
