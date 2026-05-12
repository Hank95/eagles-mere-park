import { InitialsAvatar } from "@/components/directory/initials-avatar";
import {
  shouldShowAddress,
  type HouseholdRow,
  type MemberRow,
  type ViewerContext,
  filterMemberForViewer,
} from "@/lib/households/visibility";

type HouseholdWithMembers = HouseholdRow & { members: MemberRow[] };

export function HouseholdDetailRead({
  household,
  viewer,
  canEdit,
}: {
  household: HouseholdWithMembers;
  viewer: ViewerContext;
  canEdit: boolean;
}) {
  const showAddress = shouldShowAddress(household, viewer);
  const visibleMembers = household.members.map((m) =>
    filterMemberForViewer(m, viewer),
  );

  return (
    <article className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <InitialsAvatar
            name={household.cottage_name}
            className="h-14 w-14 text-base"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {household.cottage_name}
              </h1>
              {household.is_unlisted ? (
                <span
                  aria-label="Unlisted"
                  title="Unlisted"
                  className="text-sm text-muted-foreground"
                >
                  🔒
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {household.is_year_round ? "Year-round" : "Seasonal"}
              {household.arrival_year
                ? ` · arrived ${household.arrival_year}`
                : ""}
            </p>
          </div>
        </div>
        {canEdit ? (
          <a
            href={`/households/${household.id}?edit=1`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        ) : null}
      </header>

      {showAddress && household.street_address ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Address
          </h2>
          <p className="mt-1 text-sm">{household.street_address}</p>
        </section>
      ) : null}

      {household.bio ? (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            About
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {household.bio}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Family
        </h2>
        <ul className="mt-2 space-y-3">
          {visibleMembers.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{m.name}</p>
                {m.role ? (
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                ) : null}
              </div>
              {(m.email || m.phone) ? (
                <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                  {m.email ? (
                    <>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground sm:self-center">
                        Email
                      </dt>
                      <dd>
                        <a
                          href={`mailto:${m.email}`}
                          className="underline underline-offset-2"
                        >
                          {m.email}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {m.phone ? (
                    <>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground sm:self-center">
                        Phone
                      </dt>
                      <dd>{m.phone}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
