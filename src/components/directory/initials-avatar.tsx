const PALETTE = [
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-rose-200 text-rose-900",
  "bg-indigo-200 text-indigo-900",
  "bg-orange-200 text-orange-900",
  "bg-teal-200 text-teal-900",
  "bg-fuchsia-200 text-fuchsia-900",
] as const;

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function InitialsAvatar({
  name,
  className = "h-10 w-10",
}: {
  name: string;
  className?: string;
}) {
  const colors = pickColor(name);
  return (
    <div
      className={`flex items-center justify-center rounded-full text-sm font-medium ${colors} ${className}`}
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
