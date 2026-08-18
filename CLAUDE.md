# Elevra Server — Working Agreement

Node/Express + TypeScript + Prisma API backing the Elevra mobile client. The
client is a separate repo at `../elevra` (Expo / React Native) — see its
`CLAUDE.md` for the UI side and the shared roadmap. **When a feature spans both
repos, update both files.**

---

## 1. Ground rules for changes in this repo

### One domain, four files, in this order

Every feature is a vertical slice through the same four layers. Build them bottom
up and do not skip one "because it's a passthrough".

```
prisma/schema/<domain>.prisma     model + enums
src/schemas/<domain>.ts           zod request schemas
src/repositories/<domain>.repository.ts   the only place prisma is touched
src/services/<domain>.service.ts          business rules, ownership, errors
src/controllers/<domain>.controller.ts    parse → call → respond
src/routes/<domain>.routes.ts             wire + validateAccessToken
src/routes/index.ts                       register under /v1/<domain>
```

Nest a subfolder when a domain grows several models (`notes/note.*`,
`notes/folder.*`, `notes/tag.*`; `resume/resume.*`, `resume/template.*`).

**Layer responsibilities are strict:**

- **Repository** — the *only* file allowed to import `prisma`. Plain data access,
  no throwing, no business rules. Returns `null` for a miss; the service decides
  what that means.
- **Service** — ownership checks, uniqueness checks, cross-model rules. Throws
  typed errors from `src/lib/errors.ts`. Never touches `req`/`res`.
- **Controller** — parses with a zod schema, calls one service method, shapes the
  response, and wraps everything in `try/catch { handleErrors({ res, error }) }`.
  No business logic.
- **Route** — `router.use(validateAccessToken)` at the top, then one line per
  endpoint, bound: `controller.method.bind(controller)`.

### Every query is scoped by `userId`

Non-negotiable. Repositories take `userId` as a parameter and every `where`
includes it — `findFirst({ where: { id, userId } })`, never `findUnique({ where: { id } })`.
This is the entire authorisation model; there are no roles. A repository method
that takes an `id` without a `userId` is a data leak.

### Optional properties must be conditionally spread

`tsconfig.json` sets `exactOptionalPropertyTypes: true`. Assigning `undefined` to
an optional key is a type error, so build objects with spreads:

```ts
const updateData: { name?: string; color?: string } = {
  ...(name && { name: name.trim() }),
  ...(color !== undefined && { color }),
};
```

Use `&&` when empty/falsy should be skipped, `!== undefined` when the caller must
be able to clear a field to `null` or `""`. Getting this backwards is why
`content` and `folderId` in `note.controller.ts` use `!== undefined` while
`title` uses `&&`.

### Responses have one shape

```ts
res.status(200).json({ message: "<Thing> fetched successfully!", data: <payload> });
```

`201` on create, `204` on delete, `200` otherwise. The client's `APIResponse<T>`
in `../elevra/types/response.ts` depends on this — changing it breaks every hook.

### Errors are thrown, not returned

Throw `NotFoundError`, `ConflictError`, `BadRequestError`, `ForbiddenError`, or
`UnauthorizedError` from the service. `handleErrors` maps them, plus `ZodError`,
JWT errors, multer errors, and Prisma `P2002`/`P2025`, to the right status. Never
`res.status(400)` by hand in a controller.

### Do not add unnecessary comments

Write code that explains itself. No `// get the user`, no banner comments over
every method. A comment earns its place only when the *why* is non-obvious — a
library quirk, an ordering constraint, a deliberate deviation. The entries in §5
are the bar.

### Keep the client in sync

Any new or changed endpoint means, in `../elevra`:
1. An entry in `src/provider/endpoints.ts` — the client never inlines a path.
2. A type in `types/<domain>.ts` mirroring the Prisma model *as serialised*
   (dates become `string`, `Decimal` becomes `number`).
3. A thin hook in `src/hooks/<feature>/`.

---

## 2. Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node, ESM (`"type": "module"`), `tsx` in dev |
| Framework | Express 5 |
| Language | TypeScript 7, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| DB | PostgreSQL (shared Docker container) |
| Cache | Redis via `ioredis` — hashed OTPs, 10-min TTL |
| Validation | zod v4 |
| Auth | JWT access (30 min) + refresh (7 days), **separate secrets** |
| Passwords | `bcryptjs` |
| Mail | Resend via a class-based `MailService` |
| Uploads | `multer` (memory) → Cloudinary |
| AI | `@google/genai` (Gemini) — `src/services/gemini.service.ts` |
| Streaming | SSE via `src/services/sse.service.ts`; `socket.io` installed but unused |
| Logging | `morgan("dev")` |
| Security | `helmet` |

**Imports are extensionless relative paths** (`../../lib/prisma`) — `tsx` and
`moduleResolution: "bundler"` handle it. There are no path aliases. Because
`verbatimModuleSyntax` is on, type-only imports **must** say `import type`.

---

## 3. Prisma layout

The schema is **split across files** in `prisma/schema/`, configured by
`prisma.config.ts` (`schema: "prisma/schema"`). One file per domain:

```
prisma/schema/
  base.prisma            generator + datasource ONLY
  user.prisma            User + AuthProvider/AccountStatus/Gender enums
  user-settings.prisma   UserSettings + Theme enum
  profession.prisma
  note.prisma            Folder, Tag, Note, NoteTag
  voice-recording.prisma
  resume.prisma          Resume
  template.prisma        Template, ResumeTheme
```

**Relation convention:** the foreign key and the `@relation(fields: …)` side live
in the domain's own file. `User` carries only the back-reference array. This is
stated in a comment in `user.prisma` — follow it, or `prisma generate` will
report a missing opposite relation.

The client is generated to a **custom output path**, `src/generated/prisma`.
Import `PrismaClient`, `Prisma`, and enums from `../generated/prisma/client` —
never from `@prisma/client`. Always use the singleton in `src/lib/prisma.ts`;
never construct a second `PrismaClient` (the adapter opens its own pool).

Migrations are named descriptively in snake_case
(`add_resume_and_template`, `updated_voice_recording_prisma_schema`).

---

## 4. Conventions

**Classes, not factories.** Every layer is a class instantiated as a private
field of the layer above (`private folderRepo = new FolderRepository()`).
Controllers are instantiated once at module scope in the routes file.

**Naming.** Files are kebab-case with a layer suffix
(`folder.repository.ts`). Repository methods read as data access —
`findManyByUser`, `findById`, `create`, `update`, `delete`. Service methods read
as intent — `getFolders`, `createFolder`, `deleteFolder`.

**Shared `include` objects** live at the top of the repository, typed with
`satisfies Prisma.<Model>Include`, and are reused across every method so the API
returns a consistent shape:

```ts
const noteInclude = {
  folder: true,
  tags: { include: { tag: true } },
} satisfies Prisma.NoteInclude;
```

**Counts** come from `_count: { select: { notes: true } }` in the include, not a
second query.

**Route params are possibly-undefined.** `noUncheckedIndexedAccess` types
`req.params.id` as `string | undefined`, which is why the codebase writes
`id as string`. Match it; do not add a runtime guard that the zod schema or the
`findFirst` already covers.

**Query params** are parsed with a dedicated zod schema
(`getNotesQuerySchema.parse(req.query)`), not read raw.

**Search** is `contains` with `mode: "insensitive"` across the relevant text
columns, OR'd together — see `note.repository.ts`.

---

## 5. Gotchas that have already bitten

**A missing auth token returns HTML, not JSON.** The no-token branch of
`validateAccessToken` throws `UnauthorizedError` *outside* its `try/catch`, and
**no error-handling middleware is registered** in `registerRoutes`. Express 5
forwards the throw to `finalhandler`, which does read `statusCode` off the error
— so the status is a correct `401` — but the body is an HTML error page. The
client's `useHandleErrors` reads `error.response.data.message` and gets
`undefined`, so the user sees a generic failure. Verified across every router;
it is pre-existing, not per-domain. Fix is a `handleErrors` call in that branch
or a real error middleware. Listed in §7.

**`prisma.update({ where: { id, userId } })` needs a compound-unique.** Prisma
only accepts unique fields in `where` for `update`/`delete`. This works today
because `id` is the `@id` and the extra `userId` is treated as an additional
filter — but it throws `P2025` rather than a clean 404 if the row belongs to
someone else. Services therefore call `getXById` first to produce a proper
`NotFoundError`. Keep that ordering.

**Deleting a `Folder` with notes is blocked in the service, not the schema.**
`onDelete: SetNull` would silently orphan the notes; `FolderService.deleteFolder`
throws `ConflictError` instead. If you add a similar parent/child pair, decide
this explicitly.

**SSE bypasses `handleErrors`.** `generateSummaryStream` writes its own
`sse.sendError(...)` because headers are already flushed by then. Do not wrap an
SSE handler in the normal controller try/catch pattern and expect JSON out.

**`getEnv` is overloaded.** It takes a single key (returns the value) or an array
of keys (returns an object). `validate-token.ts` destructures the array form at
module scope — before the `getEnv` import statement, which works only because of
ESM hoisting. Don't "tidy" that into a runtime call.

**Redis has no startup health check.** A dead Redis surfaces as a failed OTP
verify at request time, not at boot.

---

## 6. Domain map

| Route prefix | Router | Models |
| --- | --- | --- |
| `/v1/auth` | `auth.routes.ts` | `User`, `UserSettings` |
| `/v1/professions` | `profession.routes.ts` | `Profession` |
| `/v1/notes` | `notes/note.routes.ts` | `Note`, `NoteTag` |
| `/v1/notes/folders` | `notes/folder.routes.ts` | `Folder` |
| `/v1/notes/tags` | `notes/tag.routes.ts` | `Tag` |
| `/v1/voice-notes` | `voice-recording.routes.ts` | `VoiceRecording` |
| `/v1/resume` | `resume.routes.ts` | `Resume`, `Template`, `ResumeTheme` |
| `/v1/job-applications` | `job-application.routes.ts` | `JobApplication` + join tables |
| `/v1/notifications` | `notification.routes.ts` | `Notification` |

More specific prefixes must be registered **before** less specific ones —
`/v1/notes/folders` and `/v1/notes/tags` are registered ahead of `/v1/notes` in
`routes/index.ts`. Adding `/v1/notes/<anything>` after `/v1/notes` will be
swallowed by the note router's `/:id`.

Auth is OTP-based with no deep links: register → OTP verify → welcome mail. The
JWT payload is deliberately just `{ id }` — tier and profession are read fresh
from the DB on every request.

---

## 7. Status and open loose ends

| Area | State |
| --- | --- |
| Auth, OTP, profile, settings | Done |
| Professions | Done |
| Notes, folders, tags | Done |
| Note AI summary (Gemini, SSE stream) | **Done on the server** — gated on the client only |
| Voice recordings (upload → Cloudinary, CRUD) | Done |
| Voice transcription | Endpoint exists, not implemented |
| Resumes, templates, export | Done |
| Job Application Tracker | Done — see §8 |
| Notifications | Done — model, CRUD, Expo push, device registration |
| Career profile, cover letters, interview prep | Done — see §16, §17, §18 |
| Global search | Done — see §19 |
| Resume duplication, job descriptions | Done — see §20 |
| Account deletion | Done — see §22 |

Open loose ends, roughly in priority order:

- Voice transcription endpoint exists but is unimplemented.
- No queue system (BullMQ deferred until voice transcription needs it).
- CORS is commented out in `src/config.ts` — **deliberate**, see §15.
- No test suite. `npm run type-check` is the verification gate.

---

## 8. In flight: Job Application Tracker

The feature that connects Resume Studio, Smart Notes, and Voice Notes into one
product. **No AI involved** — plain CRUD plus join tables.

### Models (`prisma/schema/job-application.prisma`)

```
enum ApplicationStatus { SAVED APPLIED INTERVIEWING OFFER REJECTED WITHDRAWN }
enum WorkArrangement   { ONSITE HYBRID REMOTE }

JobApplication
  company, role, location?, workArrangement?, jobUrl?, source?
  salaryMin?, salaryMax?, salaryCurrency?
  status (default SAVED), appliedAt?, notes?, isArchived
  userId → User
  resumeId? → Resume        the version actually sent, onDelete: SetNull
  linkedNotes      ApplicationNote[]
  linkedRecordings ApplicationRecording[]

ApplicationNote        join JobApplication ↔ Note        (NoteTag precedent)
ApplicationRecording   join JobApplication ↔ VoiceRecording
```

Back-references to add: `User.jobApplications`, `Resume.applications`,
`Note.applications`, `VoiceRecording.applications`.

### Endpoints (`/v1/job-applications`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | list; `?status=&search=&isArchived=` |
| GET | `/stats` | counts per status for the pipeline summary |
| GET | `/:id` | detail with resume + linked notes/recordings |
| POST | `/` | create |
| PUT | `/:id` | update (incl. status change) |
| DELETE | `/:id` | delete |
| POST | `/:id/notes` | link a note (`{ noteId }`) |
| DELETE | `/:id/notes/:noteId` | unlink |
| POST | `/:id/recordings` | link a recording (`{ recordingId }`) |
| DELETE | `/:id/recordings/:recordingId` | unlink |

Register **before** any less specific prefix, and note `/stats` must be declared
ahead of `/:id`.

Link endpoints must verify the note/recording belongs to the same user before
creating the join row — otherwise linking is a cross-account read.

### Progress — **backend complete** (2026-08-17)

- [x] Prisma models + back-references + migration `20260817174538_add_job_application_tracker`
- [x] `src/schemas/job-application.ts`
- [x] `src/repositories/job-application.repository.ts`
- [x] `src/services/job-application.service.ts`
- [x] `src/controllers/job-application.controller.ts`
- [x] `src/routes/job-application.routes.ts` + registered at `/v1/job-applications`
- [x] `npx tsc --noEmit` clean
- [x] Smoke-tested end to end against the live DB — create, list, search, status
      filter, stats, update, link/unlink note, delete, plus the 400/404/409 paths

Behaviour worth knowing before touching this code:

- **`appliedAt` is stamped automatically.** Creating with a status in
  `SUBMITTED_STATUSES`, or updating a `SAVED` application to one, sets it to now
  unless the client sends its own date. Verified in both directions.
- **`salaryCurrency` is upper-cased** in the service; the client may send `"usd"`.
- **List and detail use different includes.** `listInclude` returns the resume
  title plus `_count` of linked items; `detailInclude` returns the full linked
  notes and recordings. Do not swap them — the list would fan out badly.
- **Link endpoints verify ownership of both sides** via `findOwnedNote` /
  `findOwnedRecording` before writing the join row. Without that, linking is a
  cross-account read. Keep it if you add more link types.

### Remaining client work

Tracked in `../elevra/CLAUDE.md` §9a. Not started.

---

## 9. Commands

```bash
npm run dev          # tsx watch src/server.ts
npm run type-check   # tsc --noEmit --watch
npm run build        # tsc  — use this for a one-shot typecheck before declaring done
npx prisma migrate dev --name <snake_case_name>
npx prisma generate  # after any schema edit
npx prisma studio
```

There is no test suite. A clean `npm run build` is the verification gate.


---

## 10. Notifications

`Notification` rows are the source of truth; the Expo push is a courtesy on top.

**`NotificationService.notify()` is the entry point every other service uses.**
It writes the row, checks `UserSettings.notifications`, then pushes to the
user's `deviceToken`. It **deliberately swallows its own errors** — notifying is
always a side effect of some other action (a status change, a summary
finishing), and that action must not fail because a device token went stale or
Expo was unreachable. Callers do not need to guard it.

`PushService` talks to `https://exp.host/--/api/v2/push/send` over plain
`fetch`, so there is no SDK dependency. It filters to well-formed
`ExponentPushToken[...]` values and returns `{ sent }` rather than throwing.

**Events that currently emit:**

| Event | Type | Where |
| --- | --- | --- |
| Email verified | `SYSTEM` | `auth.services.ts` → `verifyEmail` |
| Application status changed | `APPLICATION_STATUS` | `job-application.service.ts` → `updateApplication` |
| Note summary finished | `NOTE_SUMMARY` | `note.controller.ts` → `generateSummaryStream` |

Status changes only fire when the status **actually differs** from the stored
one — editing an application's location does not notify.

**Resume export deliberately does not notify.** `exportResume` is still a stub
that returns `"Export functionality coming soon"`; a notification there would
tell the user something happened that did not. Wire it up when PDF generation
lands.

`entityType` / `entityId` are loose strings, not a relation, because a
notification must outlive the record it points at. The client maps `entityType`
to a route.

**Device registration.** `POST /v1/notifications/device` updates
`User.deviceToken`. Previously the token was only captured at sign-up, so
signing in on a second device left the server pushing to an address nobody was
listening on. `getProfile` now returns `deviceToken`/`deviceType` so the client
can skip a redundant re-register.

**Not built yet:** `VOICE_TRANSCRIPTION` exists in the enum but nothing emits it.


---

## 11. Application reminders

A daily sweep nudges applications that have gone quiet.
`src/services/reminder.service.ts` holds the rules and copy;
`src/lib/scheduler.ts` runs it at 09:00 via `node-cron`, started from
`server.ts`.

| Status | Idle signal | Threshold |
| --- | --- | --- |
| `SAVED` | `createdAt` | 3 days |
| `APPLIED` | `appliedAt` | 7 days |
| `INTERVIEWING` | `statusChangedAt` | 5 days |

`lastReminderAt` enforces a 7-day cooldown, so an application is never nudged
more than once a week whichever rule matches. Archived applications are excluded.

**Never key a reminder rule off `updatedAt`.** This bit once and the fix is why
`statusChangedAt` exists. Prisma's `@updatedAt` bumps on *every* write —
including the sweep's own `markReminded` — so the reminder mechanism was
resetting the very clock it was reading, and an unrelated edit (changing a
location) did the same. `statusChangedAt` is stamped only when the status
actually changes.

`markReminded` runs **after** the notifications are sent, not before: a crash
mid-sweep should re-notify next run rather than silently mark rows as handled.

**Why `node-cron` and not BullMQ.** Reminders are time-based and idempotent — the
cooldown makes a double run harmless and a missed run simply happens the next
day — so this needs a scheduler, not a durable queue. BullMQ stays deferred
until there is work that genuinely must not be lost (voice transcription).

**`findDueForReminder` is the one repository method not scoped by `userId`**,
because the scheduled sweep runs for every user. It takes an optional `userId`
for the on-demand path. Every other method in that repository must keep its
`userId` scoping.

**Testing without waiting for 09:00:** `POST /v1/job-applications/reminders/run`
runs the sweep for the caller only. Safe to expose — it is scoped to
`req.userId`.

**Before scaling past one instance:** the cron runs in-process, so every
instance would fire its own sweep and users would get duplicate reminders. Move
it to a single worker or take a Redis lock first.

`DISABLE_SCHEDULER=true` turns the job off.


---

## 12. Subscriptions — Phase 1 built

Free/paid split and the remaining phases: `../elevra/CLAUDE.md` §13.

`UserSettings.subscriptionTier` is a `SubscriptionTier` enum (`FREE` | `PRO`).
The migration converting it from `String` uses an explicit `USING` cast —
Postgres refuses the type change without one, and Prisma would otherwise offer
to drop the column.

**`src/lib/entitlements.ts` owns the answer to "is this paid?"** — `PRO_FEATURES`
plus `assertPro(userId, feature)`, which throws `PaymentRequiredError` (402).

**Call `assertPro` from the SERVICE layer, not the controller.** A controller
guard is bypassed the moment someone points a second route at the same service
method. Currently guarded: `resume.service.exportResume` and
`note.service.streamSummary`.

**The SSE summary route is guarded twice, deliberately.** `SSEHelper`'s
constructor flushes the event-stream headers, and after that the status code is
fixed — a free user would get `200 OK` carrying an error event. So the
controller checks *before* constructing the helper, purely so the status is an
honest 402. The service check is the actual security boundary; do not remove
either.

**Not gated, on purpose:** notes, voice recordings, job applications, resumes,
and every template. `Template.isPremium` stays unused — the catalogue was built
around ATS quality, and charging for part of it means knowingly handing free
users a worse resume when export is already the gate.

Test a tier by flipping the column:
`UPDATE "UserSettings" SET "subscriptionTier" = 'PRO';`

Phase 3 will add a `Subscription` model (provider, product id, status, period
end, original transaction id) fed by a **RevenueCat webhook**. Entitlement is
derived from that row — never from a tier the client claims.


---

## 13. Resume templates

The catalogue was rebuilt around ATS parsing. Seeded by
`prisma/seed-ats-templates.ts` (idempotent — safe to re-run):

| Name | Layout | Category |
| --- | --- | --- |
| Cornerstone | `ATS_CLEAN` | ats |
| Meridian | `ATS_ACCENT` | ats |
| Headline | `MODERN_BANNER` | modern |
| Compendium | `COMPACT_DENSE` | minimal |
| Throughline | `TIMELINE_ACCENT` | modern |
| Stack | `TECH_FOCUSED` | technical |

**All six are single-column.** The original four were retired
(`isActive: false`, not deleted — existing `Resume` rows still reference them).
`CREATIVE_SPLIT` in particular was actively ATS-hostile: a sidebar breaks
reading order for most parsers.

The `LayoutKey` enum keeps the retired values so old rows still resolve. The
client maps each one to its closest surviving layout rather than rendering
nothing.

`defaultData` on every template is a realistic sample resume, not placeholder
text — templates are judged on how they look full, and lorem ipsum makes every
layout look identical.

The `FontFamily` enum (`INTER`, `LORA`, `PLAYFAIR`…) is **not honoured**. The
app only loads Bricolage Grotesque, so layouts differentiate through structure,
weight, and colour. Either load the fonts or drop the enum; do not add a
template that depends on it.


---

## 14. Resume export

`POST /v1/resume/:id/export` **does not generate a PDF.** The client builds the
resume HTML and hands it to `expo-print`, which uses the OS renderer to produce
real selectable text. This endpoint only records `lastExportedAt`, and exists so
export can be gated once subscriptions land (§12) somewhere the client cannot
bypass.

`resumeInclude` in `resume.repository.ts` **must keep `template` nested with its
`theme`**. Every renderer — preview and export alike — reads
`template.theme` for colours and spacing; a bare `template: true` hands the
client an undefined theme and export throws on the first colour lookup. This bit
once.


---

## 15. Auth hardening

> **Testing against the dev database: create a throwaway account.** The auth
> flows are destructive to test — a password reset genuinely resets a password,
> and bcrypt is one-way, so there is no putting the original back. This already
> cost a real account its password. Sign up a temporary user, test against it,
> delete it.


### Password reset

`POST /v1/auth/reset-password` consumes the OTP that `forgotPassword` writes to
`password-reset:{userId}`. That key was previously created and emailed but
**never read** — no route consumed it, so anyone who forgot their password was
permanently locked out after the app told them to check their inbox.

**Neither endpoint reveals whether an account exists.** `forgotPassword` returns
success for unknown addresses, and `resetPassword` returns the same "invalid or
expired" message for a wrong code and an unknown email. Returning 404 made both
a free account-enumeration oracle and a ready-made target list for credential
stuffing.

A successful reset also clears `failedLoginAttempts`/`isLocked` — proving inbox
ownership should lift a login lockout.

### Two different limits, doing two different jobs

**`rateLimit`** (`src/lib/rate-limit.ts`) caps request *volume* per window,
keyed on IP **and** the submitted email so rotating IPs against one account is
capped too. Redis-backed, so it holds across instances and survives deploys.
It **fails open**: if Redis is unreachable the request proceeds, because a cache
outage locking every user out of signing in is worse than briefly losing rate
limiting.

**`otpAttempts`** caps *guesses against a specific code* — 5, then the OTP is
deleted outright. A six-digit code is only 1,000,000 possibilities, so on the
reset path this is the difference between a nuisance and account takeover. The
volume limiter alone only slows that down.

Applied: signup/resend/forgot-password 3 per 10 min; verify-email and
reset-password 10 per 10 min; signin 10 per 15 min.

**`req.ip` is only trustworthy behind a configured proxy.** Nothing sets
`app.set("trust proxy", ...)`, so once this runs behind nginx or a load balancer
every request will share the proxy's IP and the IP half of each limit collapses
into one bucket. The email half still works. Set trust proxy at deploy time.

### Error middleware

`registerRoutes` now ends with a **four-argument** error handler — Express
identifies them by arity, and dropping `next` silently turns it into ordinary
middleware that never runs. Without it, anything thrown outside a controller's
try/catch fell through to Express's default handler and returned an **HTML**
error page. `validateAccessToken`'s no-token branch does exactly that, so every
expired session produced a 401 carrying HTML; the client read
`error.response.data.message`, got `undefined`, and showed a generic failure.

### Redis health check

`checkRedisHealth()` PINGs at boot. Redis holds hashed OTPs and the rate-limit
counters, so a dead Redis means nobody can sign up, verify, or reset — but the
API would otherwise start cleanly and only reveal that when a user hit the flow.

`ERROR_LOG_INTERVAL` in `redis-connection.ts` was `300000000000000` ms — the
comment said 30 seconds, the value was ~9,500 years, so connection errors logged
once and then never again. Now `30_000`.

### CORS — deliberately off

CORS is a **browser** mechanism; a React Native client does not enforce it, so
it buys nothing for a native-only API. Adding a permissive `*` would be actively
worse than none.

`sse.service.ts` sets `Access-Control-Allow-Origin: *` on its own — the one
place currently making a CORS promise. Harmless today (no browser reads it),
but it is inconsistent; scope or remove it if CORS is ever configured properly.

---

## 16. Career Profile

The user's master career history — one row per user, feeding the resume
builder's prefill. Client side, entry points, and the editor UI are in
`../elevra/CLAUDE.md` §17.

Base path `/v1/career-profile`. No id in the path: `userId` is `@unique` on the
model, so there is exactly one per account.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Returns `data: null` when none exists |
| PUT | `/` | Upsert — one write path for create and update |
| DELETE | `/` | 404s if there is nothing to delete |

**`CareerProfile` holds the same `Json` columns as `Resume`.** That is the whole
point: prefilling a new resume is a direct copy with no mapping layer, and the
client can drive both forms with one schema and one set of section components.
Add a section to one model and it has to be added to the other, or prefill
silently skips it.

**`GET` returns 200 with `data: null`, not 404.** "No profile yet" is the normal
first state of every account. A 404 would make the client's error handler toast
on the first screen a new user opens.

**A section is only written when the request actually carries it.** The service
spreads with `!== undefined`, so saving one step of the editor cannot wipe the
sections it did not touch, while sending `[]` still clears one deliberately.

**Shared section schemas live in `src/schemas/resume-data.ts`.** Both
`schemas/resume.ts` and `schemas/career-profile.ts` build on `resumeDataSchema`.
They must validate identically — a field the profile accepts but the resume
rejects would vanish the moment someone prefilled from it. That file mirrors
`../elevra/types/resume/data.ts`; change one, change both.

### A bug this uncovered in the resume slice

`resume.controller.ts` destructured only
`{ title, templateId, personalInfo, experience, education, skills }` out of the
parsed body and passed just those to the service — so **`languages`,
`certifications`, `projects`, and `references` were silently dropped on every
create and update**, and `updateResumeSchema` did not even declare them. The
client had been sending all eight sections since the builder was rebuilt; four
of them never reached the database. Both the schema and the controller are fixed
and verified against the live API.

The update path spreads each section conditionally rather than passing the
parsed body straight through: `exactOptionalPropertyTypes` rejects an explicit
`undefined`, and a blanket spread carries one for every key the client omitted.

---

## 17. Cover letters

Base path `/v1/cover-letters`. Standard slice; client side is in
`../elevra/CLAUDE.md` §18.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | `?search=` matches title, company, or role |
| GET | `/:id` | |
| POST | `/` | `title` optional — derived from company and role |
| PUT | `/:id` | |
| DELETE | `/:id` | |
| POST | `/:id/export` | Records the export. **Pro-gated.** |

**`CoverLetter` has no template catalogue of its own** — it points at the same
`Template` rows as `Resume`. A letter and the resume sent with it are read side
by side, so they must share their header, colour, font and spacing exactly, and
`Template.theme` already carries all of it. A second catalogue would double the
seeding and design work and let the pair drift apart.

**`coverLetterInclude` nests `template.theme`.** Same trap as `resumeInclude`:
both the preview and the export read `template.theme`, so a bare
`template: true` hands the client an undefined theme and rendering throws on the
first colour lookup.

**`body` is a single `String` column, not structured fields.** Paragraphs are
separated by newlines and split at render time. People write letters as prose,
and any structure imposed here would fight anyone who wants two paragraphs or
five.

**`letterDate` is stamped on create and never edited.** Manual editing means a
native date picker and a dev-client rebuild for a field nobody sets to anything
but "today" — the same call the job tracker made about `appliedAt`.

**Export is Pro, matching resume export.** `PRO_FEATURES.COVER_LETTER_EXPORT`,
asserted in the service so a second route pointed at the method cannot bypass
it. The principle is unchanged: building is free, the finished deliverable is
paid.

**`JobApplication.coverLetterId`** mirrors `resumeId`, including
`onDelete: SetNull` — deleting a letter must not erase the application it was
attached to. Ownership is checked in the service via `assertCoverLetterOwned`
before any link is written. Verified: attaching a letter belonging to someone
else 404s, and deleting a linked letter leaves the application intact with a
null link.

`src/schemas/resume-data.ts` now backs three domains — `Resume`,
`CareerProfile`, and `CoverLetter.personalInfo`. Keep it in step with
`../elevra/types/resume/data.ts`.

---

## 18. Interview prep

Base path `/v1/interview-prep`. Client side is in `../elevra/CLAUDE.md` §19.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | `?category=&status=&search=&applicationId=&unanswered=` — each question carries the caller's own answer |
| GET | `/stats` | readiness counts + rehearsals in the last 7 days |
| POST | `/practice` | records a whole run in one call |
| POST · GET · PUT · DELETE | `/`, `/:id` | user-authored questions only for write |
| PUT | `/:id/answer` | upsert |
| POST · DELETE | `/:id/answer/audio` | multipart via `upload.single("audio")` → Cloudinary |
| POST · DELETE | `/:id/applications/:applicationId` | pin a question to an application |

### The catalogue is shared, which breaks one house rule on purpose

Every other repository scopes every query by `userId`. `InterviewQuestion` cannot:
seeded rows belong to nobody and must be visible to everybody, so reads are
scoped `{ isActive: true, OR: [{ userId: null }, { userId }] }` via `visibleTo()`.

That means **"can read" and "can write" are different checks here**, and the gap
is the whole authorisation surface of this domain. `assertQuestionOwned` guards
every write and answers 403 for a seeded question, 404 for one that does not
exist. Without it any user could edit the shared catalogue for every other user.
Verified: seeded questions 403 on update and delete; a user's own custom question
is invisible to a second account.

Answers are still scoped normally, on `@@unique([userId, questionId])`.

### Why the bank is seeded by category, not by role

`prisma/seed-interview-questions.ts` holds 50 questions across six categories.
There is deliberately **no per-role tagging and no `professionId` column**.

Per-role coverage is an endless content treadmill: thousands of job titles, each
needing curation, all going stale. It would ship thin and read worse than
nothing. The questions actually worth rehearsing — behavioural, situational,
motivation — are role-agnostic anyway. Role-specific technical questions are the
user's to add or, once the AI backend lands, AI's to generate.

Every row carries `guidance`: one line on what a strong answer covers. A bare
question with no coaching is the browsable-bank failure mode the whole feature
exists to avoid. Rows are matched on `seedKey`, so re-running the seed updates in
place rather than duplicating the catalogue.

```bash
npx tsx prisma/seed-interview-questions.ts
```

### Practice is reported once, at the end

`POST /practice` takes the whole run's `questionIds`. Per-question requests would
leave a session half recorded on a bad connection — and rehearsing is exactly
when someone is on a train.

The service creates missing answer rows before incrementing. Without that, a
question someone rehearsed out loud but never wrote down would never register as
practised, and that group is precisely what the client's ordering is built to
surface.

`practiceCount` and `lastPracticedAt` live on the answer rather than in a
sessions table — they give the client its prioritisation and the stats endpoint
its numbers, and a `PracticeSession` model nothing reads would be scaffolding.

### Answer audio is not a VoiceRecording

It is `audioUrl` + `audioDuration` on the answer. A rehearsal take is not a voice
memo, and filing every take into the user's Voice Notes list would bury their
actual recordings. Upload reuses `CloudinaryService.uploadFile` under an
`interview-answers` folder.

---

## 19. Global search

One endpoint across every content type the user owns. `GET /v1/search?q=&limit=`,
four files in the usual layering, no new model and no migration.

```
src/schemas/search.ts        query schema + SEARCH_RESULT_TYPES
src/repositories/search.repository.ts   six scoped queries, narrow selects
src/services/search.service.ts          normalise, rank, count
src/controllers/search.controller.ts
src/routes/search.routes.ts             /v1/search
```

### The response is normalised, and its type names are the client's

Every hit becomes the same `{ id, type, title, subtitle?, snippet?, updatedAt }`.
`type` is one of `Note | Recording | Resume | Application | CoverLetter |
InterviewQuestion` — **the keys of the client's `CONTENT_META` verbatim**, not a
server-side naming. That is what lets the search screen read
`CONTENT_META[result.type]` for the row's icon, colour and label instead of
carrying a translation table that would drift the first time a content type is
added.

`counts` is a per-type tally for the client's filter chips, and comes from the
returned rows rather than six extra `COUNT` queries. Each type is capped at
`limit` (default 20), so a user with more than 20 matching notes sees 20 — worth
it to avoid doubling the query load on every debounced keystroke for a number
that only labels a chip.

### There is no `types` filter, deliberately

The client's chips narrow what it already holds. They have to show a count for
every type to be usable as a map of what was found, and asking the server for one
type would zero out the other five the moment a chip was tapped. The trade is
that filtering to Notes can only ever show the 20 that came back; past that the
answer is a better query, not a longer list.

### What is searched, and the three things that are not

| Type | Matched on |
| --- | --- |
| Note | `title`, `content` — **including archived** |
| Recording | `title`, `transcription` |
| Resume | `title` only |
| Application | `company`, `role`, `location`, `source`, `notes` — **including archived** |
| CoverLetter | `title`, `company`, `role`, `body` |
| InterviewQuestion | question `text` and the user's answer `text` |

**Resume bodies are not searched.** The sections live in Json columns, and
reaching them means casting to text in raw SQL — which matches the *keys* as well
as the values, so "company", "title", "location" or "description" would return
every resume the user owns. A false positive on every generic term is worse than
not searching the body at all.

**The interview bank is scoped to the user.** Only questions they wrote or have
answered. Global search finds *your* material; a seeded question never opened is
not yours yet, and matching all 50 on a word like "team" would bury the notes and
applications someone was actually looking for. Browsing the catalogue is what the
interview-prep screen's own search is for.

**Archived rows are included** even though their list screens exclude them.
Search is otherwise the only way to reach something archived without first
knowing where it was filed. The service marks them (`subtitle: "Archived"`) so
they do not read as live rows.

### Ranking is two-tier, not scored

A match on the thing's *name* outranks a match buried in a body — the first is
what the user typed, the second is a lead. Within a tier the most recently
touched wins, which is the ordering every list in the app already uses. A scored
relevance model would be guessing at weights with no data to tune them.

Interview results are dated by the **answer**, not the question: the seeded
catalogue never changes, so `question.updatedAt` would sort every bank row
identically.

### Two known limits, both accepted

`contains` runs against **raw stored content**, so a note's tentap HTML is in
scope: searching "span" or "href" can match a note whose visible text contains
neither. The 2-character floor on `q` is where this is worst, and in practice
people search words rather than element names. `stripMarkup` fixes the *display*
half — without it a snippet renders as `<p>Spoke to the</p>` — but not the
matching half.

`contains` with `mode: "insensitive"` is a sequential scan; there are no
trigram or full-text indexes. Six of them run per debounced keystroke, scoped to
one user's rows, which is fine at this size and is the first thing to revisit if
search ever feels slow. `pg_trgm` + GIN indexes is the upgrade path, and it does
not change the endpoint's shape.

---

## 20. Resume duplication and job descriptions

Two small additions, both non-AI, both aimed at the same workflow: one tailored
resume per application.

### `POST /v1/resume/:id/duplicate`

Copies a resume the caller owns and returns the new row, `201`. Optional
`{ title }` overrides the generated name.

It lives entirely in the **service** — `getResumeById` for the ownership check,
then `resumeRepo.create`. No new repository method: a duplicate is a create, and
adding a second write path would be somewhere else for the four-section data-loss
bug in §16 to come back.

**Not Pro-gated, deliberately.** Building is free and only the finished PDF is
paid (§12). One tailored resume per role is the premise of the tracker, so
charging to copy one would gate the workflow rather than the deliverable.

Two things in it are easy to get wrong:

- **Sections are spread only when non-null.** Prisma rejects a plain `null` for a
  nullable Json column — it wants `Prisma.DbNull` — so copying a resume with any
  unset section throws on the first one.
- **`nextCopyTitle` counts rather than suffixes.** "Tailored CV" → "(Copy)" →
  "(Copy 2)". Duplicating a duplicate is the *common* case here, not the edge
  one, so plain suffixing leaves people with "(Copy) (Copy) (Copy)" by the third
  role. The base is what gets trimmed against the 100-character column, since the
  suffix is the part carrying the meaning.

### `JobApplication.jobDescription`

A nullable text column holding the posting, pasted in. Additive migration
(`20260818155216_add_job_application_job_description`), no backfill.

Capped at 20000 characters rather than the 5000 `notes` uses: a real posting
routinely runs past 5000, and silently truncating one loses the requirements at
the bottom — which is the half people re-read before an interview.

It follows the `notes` shape exactly: `&&` spread on create, `!== undefined` on
update so the field can be cleared. The client had a matching bug here worth
knowing about — see `../elevra/CLAUDE.md` §25.

---

## 21. Clearing optional fields on update

`updateCoverLetterSchema` was `createCoverLetterSchema.partial()`, which makes
every optional field `string | undefined`. Combined with an omitted key already
meaning "leave this alone", there was **no way for a client to say "I cleared
this"** — a letter addressed to a named person could not be un-addressed, and the
controller's `!== undefined` spreads had nothing to act on.

The four clearable fields are now `.nullable()` via `.extend()` on top of the
partial. Create stays non-nullable: there is nothing to clear on a row that does
not exist yet, and accepting null there only widens what the service must handle.

**Check this whenever an update schema is derived with `.partial()`.** It is the
right default for required fields and the wrong one for anything the user is
allowed to empty. `updateJobApplicationSchema` was already written out longhand
with `.nullable()` on exactly those fields, which is why the tracker only needed
a client fix while cover letters needed both sides.

---

## 22. Account deletion

`DELETE /v1/auth/account`, authenticated, `204`. Both stores require an account
that can be created in-app to be deletable in-app (Apple 5.1.1(v) is the one
that gets apps rejected), so this is a submission requirement rather than a
feature.

**It is a hard delete, not a status flag.** `AccountStatus` exists and would have
been the cheaper route, but a soft delete leaves the data on our servers, which
is precisely what the user asked us not to do. One `prisma.user.delete` is enough
because every owned model declares `onDelete: Cascade` on its `userId` — notes,
folders, tags, resumes, recordings, applications, letters, questions, answers,
settings and notifications all go with the row.

**The password is the safeguard.** An unlocked phone in the wrong hands should
not be able to erase someone's work in two taps. Accounts with a null `password`
(a future OAuth provider) skip the check, since there is nothing to compare
against — which is why `deleteAccountSchema` marks it optional and the *service*
decides whether it is required. The schema layer does not know how the account
was created.

### Uploaded files are destroyed first, and the coverage is partial

Voice recordings carry a Cloudinary `publicId`, so they are destroyed before the
rows cascade away — afterwards the handles are gone and the files are orphaned
forever. Deleting the record of someone's voice memos while leaving the audio
hosted would defeat the point.

`CloudinaryService.destroyMany` is best-effort and **never throws**: a Cloudinary
outage must not block someone from deleting their account.

**Two gaps, both structural.** Profile pictures and interview answer audio store
a URL but no `publicId`, so they cannot be destroyed by handle. Add a publicId
column to either and it can join this call. Worth doing before launch if the
privacy policy promises full erasure.

No confirmation email is sent — there is no template for it, and the address is
gone by the time it would send. Worth adding with a pre-delete send if it matters.
