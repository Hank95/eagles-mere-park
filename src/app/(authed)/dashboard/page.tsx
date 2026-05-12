export default function DashboardPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere Park — Members
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome
        </h1>
        <p className="text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          Browse the <a href="/directory" className="underline underline-offset-2">directory</a>.
          Events, map, photos, and documents are on the way.
        </p>
      </div>
    </main>
  );
}
