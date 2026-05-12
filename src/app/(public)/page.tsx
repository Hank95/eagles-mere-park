export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Eagles Mere, Pennsylvania
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Eagles Mere Park
        </h1>
        <p className="text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          A private community website for the cottages, families, and history of
          Eagles Mere Park. Members sign in to access the directory, events,
          map, photos, and documents.
        </p>
        <p className="pt-2 text-xs text-muted-foreground">
          Placeholder landing page — real design lands in a later phase.
        </p>
      </div>
    </main>
  );
}
