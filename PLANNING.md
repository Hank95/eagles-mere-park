# Eagles Mere Park — Community Site

A members-only website for the Eagles Mere Park community: directory, events, an illustrated village map, photo galleries, and a document library. ~50–150 households. Side project, single tenant, built to be a quiet labor of love.

This document is the source of truth for what we're building, why, and the decisions that shape the code. Update it when decisions change. If something here contradicts the code, fix one of them.

---

## 1. Context

### 1.1 The community

Eagles Mere Park is a private community within Eagles Mere, PA — a small lakeside village in the Endless Mountains with a long resort history. The Park is a tight-knit, multi-generational community where families have summered for decades. Cottages have names. People know their neighbors. The feel is screen porches and wood paneling, not Silicon Valley.

The site should match that vibe: warm, curated, distinctly *Eagles Mere*, not a generic HOA portal.

### 1.2 Project goals

In priority order:

1. **Build something the community actually uses.** Real users, real value. If members don't open it weekly, the project failed.
2. **Make it feel like Eagles Mere.** The visual identity matters as much as the features. An illustrated village map is the signature element.
3. **Stay maintainable as a solo side project.** Boring tech, minimal abstractions, clear handoff path if the maintainer changes.
4. **Serve as a learning prototype for resident-experience patterns.** Lessons learned here may inform future work on BTR community portals, but this codebase is single-purpose. Don't over-engineer for that.

### 1.3 Non-goals

- Multi-tenant architecture. Single community, hardcoded references to "Eagles Mere Park" are fine.
- A theme system. Style is fixed to Eagles Mere's identity.
- Property management system integrations. Members create accounts directly.
- Native mobile apps. Mobile web only.
- Discussion forums / message boards. The community has email and porches; another comms channel would just add moderation burden.
- Public directory or public events. Privacy is paramount.

---

## 2. Audience & access model

**Mostly private with a thin public face.**

- **Public:** A single landing page (history, photos of the lake, "this is Eagles Mere Park"), a contact form for membership/rental inquiries, and a login button. No public member data, no public events, no public photos.
- **Members:** Everything else. Auth required.
- **Admins:** A small group (likely 2–4 board members or designees) who can manage announcements, moderate content, edit any member's record if needed, and manage the document library.

### 2.1 Roles

| Role | Capabilities |
|---|---|
| Visitor | Public landing page only |
| Member | Browse directory, post/RSVP to events, upload photos to existing galleries, view documents, edit own profile |
| Admin | Everything members can do, plus: post announcements, create galleries, manage documents, edit any profile, manage user accounts |
| Superuser (dev) | Database-level access. One person (the maintainer). Not exposed in UI. |

### 2.2 Privacy defaults (important)

Older members in particular will care about this. Conservative defaults:

- Name and cottage name visible to other logged-in members by default.
- Phone, email, mailing address: **opt-in** per field. Members choose what to share.
- "Unlisted" option: profile exists for auth but is not visible in the directory.
- Photos of people: any member can request removal of any photo of themselves or their family, no questions asked.
- Children under 18: extra care. Either no photos identifiable by name, or per-family opt-in for kids' photos. Decide with the board before launch.

---

## 3. Feature set

### 3.1 MVP (launch-required)

#### Public landing page
A single beautiful page. Hero image of the lake, a few paragraphs about the community and its history, a contact form, a login link. No navigation to other public pages. Optimized to look great and load fast.

#### Authentication
Email + password login via Supabase Auth. Optional Google sign-in for members who prefer it. Account creation is admin-approved — admins invite members by email, no self-signup. Standard password reset flow via email.

Rationale: magic links sound nice but add friction every login (check email, click button, hope the link didn't expire). Members are comfortable with passwords; password managers handle the boring parts. Save the user a step.

#### Member directory
The spine of the site. Each household has a profile:

- Cottage name (e.g., "The Pines")
- Street address (within the Park)
- Family members — one entry per person, each with name, optional role (e.g., "year-round," "summer," "extended family"), and per-person email/phone
- Year the family first arrived at Eagles Mere
- Year-round vs. seasonal designation
- Contact info: phone(s), email(s), mailing address — each field with its own privacy toggle
- Optional cottage photo and/or family photo
- Optional short bio / "about us"

Features:
- Search by name, cottage name, or street
- Filter by year-round / seasonal
- Sort by cottage name, family name, or arrival year
- Members edit their own household; admins can edit any
- Profile links to the cottage on the map (and vice versa)

#### Events & announcements
A unified chronological feed plus a calendar view.

- **Events** can be posted by any member. Fields: title, description, date/time, location, optional RSVP, optional photo.
- **Announcements** can be posted by admins only. Same fields as events but with an "announcement" flag for visual distinction (e.g., water shutoff, board meeting, regatta sign-ups).
- RSVP is optional per event. Shows count + list of attendees to other members.
- Past events stay accessible (they become part of community history).
- Weekly email digest: "This week at Eagles Mere Park" — upcoming events, recent announcements, new photos. Sent Sunday evenings.

#### Interactive village map
The signature feature. See Section 4 for the design and technical approach.

- Custom illustrated SVG of Eagles Mere Park
- Cottages are interactive elements
- Hover: subtle highlight + tooltip with cottage name
- Click: opens a custom-styled popover/panel with the cottage's photo, name, current household (linked to directory), year built (if known), and optional history snippet
- Pan and zoom for mobile + desktop
- Optional filter overlays: year-round residents, new families this year, cottages built before a certain year (defer to V2 if scope creeps)

#### Photo galleries
Organized by event and by year.

- Galleries (e.g., "Fourth of July 2024", "Regatta 2024", "Winter 2023")
- Admins create galleries; members upload photos to existing galleries
- Per-photo captions, optional
- Member-requested removal flow
- Thumbnails grid, lightbox view, swipe on mobile
- EXIF stripped on upload (privacy + file size)
- Reasonable file size limits and image optimization on upload

#### Document library
Bylaws, meeting minutes, financial reports, annual directory PDF, useful local info (water company, trash schedule, etc.).

- Folder structure (flat is fine: Governance, Minutes, Forms, Local Info)
- Upload date and short description per document
- Search by filename and description
- PDFs preview inline; other types download
- Admin-only upload; members read-only

### 3.2 V2 (post-launch, prioritized by member feedback)

- **Cottage history pages** — richer than the map popover. Timeline of owners, archival photos, stories submitted by members. This could become a real treasure over years.
- **Classifieds / lost-and-found** — very lightweight. "Anyone have a spare paddle?" Expiring posts.
- **Member-to-member messaging** — only if requested. Otherwise the directory's contact info is sufficient.
- **PWA install prompt** — if mobile usage is high.
- **Push notifications** — for event reminders, only if members ask for it.

### 3.3 Explicitly out of scope

- Payment processing / dues collection (board has existing tools for this)
- Reservation/booking systems (tennis courts, etc.) — defer indefinitely
- Anonymous feedback or complaint forms
- Real-time chat
- Public-facing rental listings

---

## 4. The map

The map is the project's signature feature. Get this right; everything else is table stakes.

### 4.1 Visual direction

Not a real geographic map (Google Maps already exists). Not pure hand-drawn (charming but doesn't match the "polished + authentic" feel we want). Target: **a custom illustrated SVG with a polished, modern aesthetic that still feels warm and place-specific.**

Reference points:
- The kind of illustrated estate or village maps you'd see framed in a clubhouse
- Clean line work, considered color palette, distinct without being twee
- The illustration style of brands like Stripe (docs), Mailchimp, or The Pudding's data essays — warm, vector-clean, modern but not sterile

Open question: commission an illustrator (~$800–3,000 for something genuinely good) vs. produce it ourselves in Figma/Illustrator (~20–40 hours of work). Recommendation: get illustrator quotes early; this is the make-or-break aesthetic decision and may be worth board contribution.

### 4.2 Technical approach

- One SVG file, embedded in a React component
- Each cottage is a `<g>` element with `data-cottage-id` matching a row in the `cottages` table
- Hover state: CSS class toggle for highlight (subtle glow, fill change, or scale)
- Click: opens a popover or side panel rendered by React, fully custom-styled, pulling data from the API
- Pan and zoom: a lightweight library (`react-svg-pan-zoom` or `panzoom`) — no map tiles, no Leaflet
- Layered SVG: base illustration layer always visible; cottage shapes layer is the interactive layer; optional overlay layers for filters
- Responsive: same SVG scales for mobile; popover becomes a bottom sheet on small screens

### 4.3 Data model intersection

The `cottages` table is the bridge between the map and the directory. A cottage row has the cottage's name, optional year built, optional history, and a foreign key to the household that lives there (nullable — some cottages may be vacant or in transition). The SVG's `data-cottage-id` maps directly to a `cottages.id`.

---

## 5. Architecture

### 5.1 Stack

- **Frontend:** Next.js (App Router) on Vercel
- **Database + Auth + Storage:** Supabase (Postgres, email + password auth, file storage)
- **Styling:** Tailwind CSS + shadcn/ui
- **Map:** Custom SVG + React + `react-svg-pan-zoom` (or similar)
- **Email:** Resend (transactional + weekly digest)
- **Hosting:** Vercel (free tier viable at this scale)

Estimated cost: ~$0–10/month at MVP scale. Domain + maybe Resend's paid tier if email volume grows. Under $200/year all-in is realistic.

### 5.2 Data model (initial sketch)

```
households
  id, cottage_name, street_address, arrival_year,
  is_year_round, bio, cottage_photo_url, family_photo_url,
  is_unlisted, created_at, updated_at

members  (people, multiple per household)
  id, household_id, name, role, email, phone,
  email_is_public, phone_is_public, address_is_public,
  user_id (nullable, FK to auth.users for those who log in)

cottages  (physical buildings, distinct from households for history)
  id, name, year_built, history_text, household_id (nullable),
  map_element_id (matches SVG data-cottage-id)

events
  id, title, description, starts_at, ends_at, location,
  is_announcement, created_by, photo_url, rsvp_enabled

rsvps
  event_id, member_id, status, created_at

galleries
  id, title, event_date, description, created_by

photos
  id, gallery_id, url, caption, uploaded_by, taken_at

documents
  id, folder, title, description, file_url, file_type,
  uploaded_by, uploaded_at

audit_log  (lightweight — admins should be able to see who changed what)
  id, actor, action, target_type, target_id, timestamp, metadata
```

Use Supabase Row-Level Security (RLS) aggressively. Most tables: read requires authenticated user; write requires either ownership (your own household/profile) or admin role. RLS catches bugs that application code misses.

### 5.3 Auth model

- Supabase Auth, email + password primary, optional Google
- Standard email-based password reset flow
- Admin role stored in `auth.users.app_metadata.is_admin`, set via service-role API and read from the JWT in RLS policies (no joins to a roles table — see §9)
- Signup disabled at the auth layer (`DISABLE_SIGNUP=true`); admins invite new members via `admin.inviteUserByEmail`. Google OAuth only succeeds for already-invited emails — Supabase auto-links the OAuth identity to the pre-created user.
- Email domain not restricted (members use personal emails)

### 5.4 Hosting and deployment

- Vercel for the app, with preview deployments on PRs
- Supabase project for db/auth/storage
- Domain: TBD (eaglesmerepark.com or similar — check availability with board)
- Backups: Supabase point-in-time recovery on paid tier; weekly db dump to S3 as belt-and-suspenders

### 5.5 Boundaries to respect

- Don't build a CMS. Use the database directly via simple admin pages.
- Don't build a permissions framework. RLS + a single `is_admin` check is enough.
- Don't build a notification system. Email + in-app feed is enough.
- Don't add features without checking against Section 3.3 "out of scope."

---

## 6. Roadmap

Phases, not timelines. Ship when each phase is done; some phases will collapse into a single focused sprint, others (especially the map) take longer because external dependencies (illustration) gate them. With Claude Code in the loop and remote dev set up, the first few phases can compress significantly — a productive weekend can plausibly cover Phases 0–2.

**Phase 0 — Setup**
- Repo, Next.js scaffold, Vercel + Supabase wired up
- Tailwind + shadcn/ui installed
- Basic public landing page (placeholder content)
- `CLAUDE.md` / `AGENTS.md` with code conventions committed

**Phase 1 — Auth & member shell**
- Email + password auth working, password reset flow
- Admin-invite flow (admins can create new member accounts)
- Stub members-only area behind auth
- Basic layout: nav, header, footer, signed-in user menu

**Phase 2 — Directory**
- Households + members data model
- Directory list page (search, filter, sort)
- Household detail page
- Edit-your-own profile flow with per-field privacy toggles
- Admin: edit-any flow

**Phase 3 — Events & announcements**
- Events + RSVP data model
- Feed view, calendar view
- Create/edit event flow
- Announcement vs. event distinction

**Phase 4 — The map**
This phase has an external dependency (the illustration) that doesn't compress no matter how fast the code goes. Start the illustration work in parallel with Phase 0 so it's ready when code is.

- SVG illustration sourced (commissioned or DIY)
- Cottages data model + linking to households
- Interactive SVG component with hover + click
- Popover/side panel with cottage data
- Pan & zoom, mobile support

**Phase 5 — Photos & documents**
- Galleries + photos data model
- Upload flow with image optimization, EXIF stripping
- Gallery views (grid, lightbox)
- Documents data model + upload + folder navigation

**Phase 6 — Polish & email**
- Weekly digest email (Resend + scheduled function)
- Empty states, error handling, loading skeletons
- Performance pass (images, bundle size)
- Accessibility pass

**Phase 7 — Closed beta**
- Invite 5–10 friendly members
- Iterate on feedback
- Broader rollout when feedback settles

### 6.1 Pacing notes

- The bottleneck is rarely code anymore — it's decisions (Section 8), content (real cottage data, real photos), and the illustration. Push those forward early and aggressively; they're the real critical path.
- Don't let Kiawah training suffer. Code is recoverable; a marathon block is not. If a weekend is a long-run weekend, the project waits.
- Resist the urge to ship the map before it's beautiful. A mediocre map damages the project's identity more than a missing map does. Ship without it if needed and add it when the illustration is right.

---

## 7. Non-technical considerations

These will matter more than any technical decision. Don't skip.

### 7.1 Governance & buy-in

Before significant work: confirm with whoever asked for this site —
- Who *owns* the site? (Personal project? Community association? Define it.)
- Who pays for hosting and domain? (Small but ongoing. Even $100/year matters in a community budget.)
- Who has final say on content policies (photo removal, privacy defaults, etc.)?
- What's the handoff plan if the maintainer steps away in 5 years?

Even an informal "here's the repo, here's the Supabase login, here's a runbook" handoff doc dramatically increases the site's lifespan.

### 7.2 Data import

The community likely has a printed directory or a spreadsheet. The smoothest launch path:
1. Get the existing data, however messy
2. Import into the database as initial seed
3. Send invites
4. Each member verifies and corrects their own entry

Way better than asking everyone to re-enter from scratch.

### 7.3 Content policy

A simple document, agreed with the board:
- Photo removal on request, no questions asked
- Children's photo policy (decide before launch)
- What happens when a family leaves the community (profile archived? deleted? read-only?)
- What happens when a member dies (memorial flag? frozen profile?)
- Acceptable content for member-posted events

### 7.4 Communications plan for launch

A site nobody knows about is a site nobody uses. Plan:
- Soft launch with a few friendly members (Phase 7)
- Announcement at a community gathering or via existing email list
- Printed quick-start sheet for less-online members
- Designated humans (probably the board members who are admins) to help members log in for the first time

---

## 8. Open questions

Track these. Resolve before they block work.

- [ ] Illustrator: commission or DIY? Get quotes by end of Phase 1.
- [ ] Domain name confirmed with board.
- [ ] Hosting ownership: personal Vercel/Supabase or community-owned billing?
- [ ] Admin identity: who, specifically? Need 2–4 names.
- [ ] Children's photo policy decision with board.
- [ ] Source data for directory import — who has it, what format?
- [ ] Existing community email list — keep, replace, or integrate with weekly digest?
- [ ] Year-round vs. seasonal definitions (some families are mixed) — how to model?
- [ ] Mobile usage assumption: is the audience iPhone-heavy, Android-heavy, mixed? Affects testing priorities.

---

## 9. Decisions log

Append-only. When a decision is made, record it here with date and rationale. Future-you and future-agents need this.

- **2026-05-11** — Single tenant only. No multi-tenant abstractions. Maymont BTR work, if it happens, will be a separate codebase. Rationale: premature abstraction costs weekend time we don't have, and the eventual BTR product will need different architecture anyway (PMS integration, native mobile, scale).
- **2026-05-11** — Custom SVG map, not Leaflet/real maps. Rationale: aesthetic fit, privacy comfort, technical simplicity, custom popovers without fighting Leaflet defaults.
- **2026-05-11** — No discussion board / forum. Rationale: communities this size don't need another comms channel; would add moderation burden.
- **2026-05-11** — Markdown planning doc (this file) lives in repo root or `/docs`. Agent-readable, version-controlled, single source of truth.
- **2026-05-11** — Email + password auth, not magic links. Rationale: magic links add friction every login; members are comfortable with passwords and password managers; standard reset flow is well-understood.
- **2026-05-11** — Roadmap is phase-based, not time-based. Rationale: with Claude Code + remote dev, early phases compress significantly; external dependencies (illustration, content, board decisions) are the real critical path; arbitrary weekend estimates created false constraints.
- **2026-05-11** — Admin role stored in Supabase Auth `app_metadata.is_admin`, set server-side via the service-role API by an existing admin. RLS policies read the claim from the JWT, e.g. `(auth.jwt()->'app_metadata'->>'is_admin')::boolean`. Rationale: JWT claims are free to evaluate in policies (no joins, no recursion risk where a policy queries the same table it protects), and `app_metadata` is server-set so it cannot be self-elevated by the client. Considered and rejected: an `is_admin` column on `members` and a separate `user_roles` table — both require joins inside RLS and slow down every authenticated read.
- **2026-05-11** — Account-creation gate at the auth layer, not the application layer. Supabase project runs with `DISABLE_SIGNUP=true`. Admins create accounts via `admin.inviteUserByEmail` from a server route guarded by the admin JWT claim. This blocks both email signup and unknown-email Google OAuth — Google sign-in succeeds only for emails that have already been invited (Supabase auto-links the OAuth identity to the existing user). Rationale: no `pending` state needed in `members`, no half-approved users browsing the directory, no application-layer race conditions; the gate lives where it's enforceable atomically.

---

## 10. For future agents

If you (Claude, or any AI assistant) are reading this to help with the project: read this whole doc before suggesting changes to architecture or scope. The non-goals (Section 1.3) and out-of-scope features (Section 3.3) are intentional. If a request seems to violate them, surface that to the human before building.

The repo conventions, code style, and library choices will be documented separately in `CONVENTIONS.md` (or `AGENTS.md` / `CLAUDE.md`) once the codebase is scaffolded. Add to this PLANNING.md only when product scope or architectural direction changes; record those changes in Section 9.
