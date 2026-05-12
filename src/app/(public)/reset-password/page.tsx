import { ResetRequestForm } from "@/components/auth/reset-request-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to set a new
            password.
          </p>
        </div>

        {error === "invalid_link" ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            That reset link is invalid or expired. Request a new one below.
          </p>
        ) : null}

        <ResetRequestForm />

        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="underline underline-offset-2">
            Back to sign in
          </a>
        </p>
      </div>
    </main>
  );
}
