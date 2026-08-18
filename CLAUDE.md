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

Open loose ends, roughly in priority order:

- No error-handling middleware (see §5 — causes the 401→500 bug).
- CORS is commented out in `src/config.ts`.
- No rate limiting on the OTP endpoints.
- Redis startup health check.
- Password-changed confirmation email.
- No queue system (BullMQ deferred until voice transcription needs it).
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

## 12. Subscriptions — planned, not built

Full plan and the free/paid split live in `../elevra/CLAUDE.md` §13. Server-side
notes:

- `UserSettings.subscriptionTier` is currently a loose `String` defaulting to
  `"free"`. Phase 1 replaces it with a `SubscriptionTier` enum (`FREE` | `PRO`).
- **The entitlement guard belongs in the service layer**, next to the existing
  ownership checks — not in the controller. A guard in the controller is bypassed
  the moment someone adds a second route to the same service method.
- Phase 3 adds a `Subscription` model (provider, product id, status, period end,
  original transaction id) fed by a **RevenueCat webhook**. Entitlement is
  derived from that row. Never trust a tier sent by the client.
- `Template.isPremium` already exists and is unused — it is the natural first
  thing to gate.


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
