# ThryveUp — Master Plan

> Living roadmap covering (a) fixing what the audit found and (b) building the **Project / Project Vault** module.
> Stack: Next.js 14 (App Router) · Prisma + MongoDB Atlas · NextAuth v5 · Tailwind · TypeScript.
> Owner: single operator. Last updated: 2026-06-13.

---

## Guiding principles

- **Security before features.** Don't store client secrets behind an auth layer that still has IDOR holes.
- **One ownership pattern everywhere.** Every DB read/write is scoped to `session.user.id`, re-checked server-side.
- **Hash for auth, encrypt for reuse.** Login passwords stay one-way bcrypt; Vault credentials use reversible AES-256-GCM.
- **No dead/duplicate write paths.** Prefer server actions; delete unused REST routes rather than maintain two.
- **Each phase ships independently** and leaves the app in a working state.

---

## Phase 0 — Critical security fixes (do first)

**Goal:** close the holes the audit found before any new data (especially secrets) is added.

| # | Task | File(s) | Done |
|---|------|---------|------|
| 0.1 | Add `userId` ownership check to notifications `PATCH` and `DELETE` | `app/api/notifications/route.ts` | ☐ |
| 0.2 | Remove client-controllable `userIdInput` from `createNotification`; always derive from session | `app/actions/notifications.ts` | ☐ |
| 0.3 | Remove `PrismaAdapter`/`prisma` from the Edge middleware config (JWT-only edge config) | `lib/auth-edge.ts`, `middleware.ts` | ☐ |
| 0.4 | Verify middleware + login still work after edge change (local + a real deploy) | — | ☐ |

**Exit criteria:** a second test account cannot read/modify/delete the first account's data through any route; middleware runs on Vercel Edge without Prisma errors.

---

## Phase 1 — Foundation hardening & cleanup

**Goal:** stabilize the existing app so the new module builds on solid ground. Low-risk, high-leverage.

### 1a. Correctness bugs
| # | Task | File(s) | Done |
|---|------|---------|------|
| 1.1 | Calendar: re-fetch events on month change via `?month=YYYY-MM` | `components/CalendarView.tsx`, `app/api/events/route.ts` | ☐ |
| 1.2 | Calendar: implement the **Week** view (or hide the toggle until built) | `components/CalendarView.tsx` | ☐ |
| 1.3 | Calendar: fix `toISOString()` timezone shift on day-click prefill | `components/CalendarView.tsx` | ☐ |
| 1.4 | Calendar: add confirm step before click-to-delete event | `components/CalendarView.tsx` | ☐ |
| 1.5 | Login: honor `callbackUrl` instead of hardcoded `/` | `app/actions/auth.ts`, `app/(auth)/login/page.tsx` | ☐ |
| 1.6 | Expenses: recompute summary cards/charts after add/edit/delete (single source of truth) | `components/ExpenseDashboard.tsx` | ☐ |
| 1.7 | Unify duplicated category constants (fix `Family Support` emoji drift) into one shared module | `components/ExpenseDashboard.tsx`, `components/QuickAddModal.tsx` | ☐ |

### 1b. Dead code & redundancy
| # | Task | File(s) | Done |
|---|------|---------|------|
| 1.8 | Delete orphaned `LoansDashboard.tsx` and `MarkdownEditor.tsx` | `components/` | ☐ |
| 1.9 | Remove unused REST duplicates (`api/loans`, `api/tasks` POST) OR standardize on one path | `app/api/...` | ☐ |
| 1.10 | Remove unused `HandCoins` imports; strip LLM "thinking" comments | `components/Sidebar.tsx`, `MobileNav.tsx`, `app/api/notes/route.ts` | ☐ |
| 1.11 | Decide nav: surface Loans, or fully merge into Expenses; align desktop + mobile nav | `components/Sidebar.tsx`, `MobileNav.tsx` | ☐ |

### 1c. Robustness (PRD gaps)
| # | Task | File(s) | Done |
|---|------|---------|------|
| 1.12 | Add `loading.tsx` + `error.tsx` to each dashboard route | `app/(dashboard)/**` | ☐ |
| 1.13 | Add root `not-found.tsx` and `global-error.tsx` | `app/` | ☐ |
| 1.14 | Strengthen auth: raise password min length, add basic register/login rate-limit | `app/actions/auth.ts` | ☐ |
| 1.15 | Re-enable lint in build (remove `eslint.ignoreDuringBuilds`) once warnings cleared | `next.config.mjs` | ☐ |
| 1.16 | Write a real `README.md` (setup, Mongo Atlas, env, Vercel) + `prisma/seed.ts` | `README.md`, `prisma/seed.ts` | ☐ |

**Exit criteria:** calendar works across months + week view; no orphaned components; loading/error states exist; lint passes in build.

---

## Phase 2 — Scheduler infrastructure (shared dependency)

**Goal:** replace the client-only `setInterval` reminders with a real server scheduler. Needed by both the existing 8 AM summary *and* the Vault expiry reminders, so build it once.

| # | Task | File(s) | Done |
|---|------|---------|------|
| 2.1 | Add a Vercel Cron config | `vercel.json` | ☐ |
| 2.2 | Create an authenticated cron route (secret header / `CRON_SECRET`) | `app/api/cron/route.ts` | ☐ |
| 2.3 | Move daily 8 AM summary + 30-min task alerts server-side into the cron scan | `app/api/cron/...` | ☐ |
| 2.4 | Keep browser/toast notifications as a *presentation* layer over DB notifications | `components/NotificationBell.tsx` | ☐ |

**Exit criteria:** notifications fire without a browser tab open; cron route rejects unauthenticated calls.

---

## Phase 3 — Project Vault: data model

**Goal:** model projects, secrets, issues, and reminders. All `userId`-scoped, mirroring the existing `Task`/`Loan` ownership pattern.

| # | Task | File(s) | Done |
|---|------|---------|------|
| 3.1 | `Project` model: name, clientName, clientInfo, status, techStack[], repoUrl, liveUrl, adminUrl, hostingProvider, dbProvider, maintenanceStatus, notes, lastUpdatedAt | `prisma/schema.prisma` | ☐ |
| 3.2 | `ProjectCredential` model: label, username?, `ciphertext`, `iv`, `authTag`, kind (env/login/payment/domain/db) | `prisma/schema.prisma` | ☐ |
| 3.3 | `ProjectIssue` model: title, description, status (OPEN/IN_PROGRESS/RESOLVED), version/log entries, timestamps | `prisma/schema.prisma` | ☐ |
| 3.4 | `ProjectReminder` model: type (DOMAIN/HOSTING/BACKUP/FOLLOW_UP/RENEWAL), dueDate, note, isDone | `prisma/schema.prisma` | ☐ |
| 3.5 | Add relations to `User`; `npx prisma db push`; regenerate client | `prisma/schema.prisma` | ☐ |

**Exit criteria:** `prisma db push` succeeds; types generate; no impact on existing models.

---

## Phase 4 — Project Vault: encryption layer

**Goal:** reversible app-layer encryption so secrets are stored as ciphertext but retrievable on demand by the owner.

> Decision (confirmed): **AES-256-GCM, app-layer, single operator, reveal-on-demand.**

| # | Task | File(s) | Done |
|---|------|---------|------|
| 4.1 | Add `ENCRYPTION_KEY` (32-byte) to env + `.env.example` (separate from `NEXTAUTH_SECRET`) | `.env*`, Vercel settings | ☐ |
| 4.2 | `lib/crypto.ts` (server-only): `encrypt(plaintext) → {ciphertext, iv, authTag}` and `decrypt(...)` using Node `crypto` aes-256-gcm | `lib/crypto.ts` | ☐ |
| 4.3 | Server actions for credential CRUD; **decrypt only after `session.user.id === project.userId`** and only on explicit reveal | `app/actions/projects.ts` | ☐ |
| 4.4 | Ensure secret plaintext is **never** in the default page payload (ship ciphertext-free fields; reveal via action) | actions + page | ☐ |
| 4.5 | Document key-loss/leak policy: back up `ENCRYPTION_KEY` outside the DB | this file / README | ☐ |

**Exit criteria:** a credential round-trips (encrypt → store → reveal → matches); DB inspection shows only ciphertext; revealing requires ownership.

---

## Phase 5 — Project Vault: UI

**Goal:** the actual screens, reusing existing patterns (`LoansDashboard` cards, tabbed details, `ExpenseDashboard` forms).

| # | Task | File(s) | Done |
|---|------|---------|------|
| 5.1 | Sidebar + mobile nav entry: **Projects** | `components/Sidebar.tsx`, `MobileNav.tsx` | ☐ |
| 5.2 | Projects dashboard: cards/list (name, client, status, tech stack, live link, last updated, maintenance status) | `app/(dashboard)/projects/page.tsx` | ☐ |
| 5.3 | Project details page with tabs: Overview · Features · Credentials · Deployment · Issues · Notes | `app/(dashboard)/projects/[id]/page.tsx` | ☐ |
| 5.4 | Credentials tab: hidden-by-default, reveal toggle, copy button (reveal calls decrypt action) | component | ☐ |
| 5.5 | Issues tab: add issue → status workflow → resolution log / version history | component | ☐ |
| 5.6 | Loading/error states for the new routes | `app/(dashboard)/projects/**` | ☐ |

**Exit criteria:** full create→view→edit→delete works for projects, credentials, and issues, all owner-scoped.

---

## Phase 6 — Project Vault: reminders & maintenance workflow

**Goal:** wire Vault reminders into the Phase 2 scheduler and formalize the maintenance loop.

| # | Task | File(s) | Done |
|---|------|---------|------|
| 6.1 | Cron scan of `ProjectReminder` → create notifications for due domain/hosting/backup/follow-up/renewal | `app/api/cron/route.ts` | ☐ |
| 6.2 | Reminder UI on the project details page (add/edit/complete) | component | ☐ |
| 6.3 | Maintenance flow surfaced in UI: open project → check credentials/deployment → log issue → resolve → bump version history | components | ☐ |
| 6.4 | Optional: dashboard widget for upcoming expiries / projects needing attention | `app/(dashboard)/page.tsx` | ☐ |

**Exit criteria:** an expiry reminder fires via cron with no tab open; the full report→fix→log loop is doable in the UI.

---

## Backlog / later (not scheduled)

- Profile page: implement Change Password, Delete Account, edit name/avatar (currently dead buttons).
- 2FA / connected devices (profile stubs).
- Notes: move base64 inline images out of the `content` field (MongoDB 16MB doc limit risk); sanitize HTML if notes ever become shareable.
- Tests (none today) — at least cover crypto round-trip and ownership checks.
- Migrate `useFormState` → `useActionState` if/when upgrading React.

---

## Phase order at a glance

```
0  Security fixes            ──► must precede everything
1  Foundation & cleanup      ──► stabilize
2  Scheduler infra           ──► shared by 6 (and fixes existing reminders)
3  Vault data model          ─┐
4  Vault encryption          ─┤ the new module
5  Vault UI                  ─┤
6  Vault reminders/workflow  ─┘
```
