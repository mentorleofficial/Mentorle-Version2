# Mentorle Plus + Payments (Cashfree) — Foundation Design

**Date:** 2026-07-22
**Status:** Phase 0 (foundations) + Phase 1 (paid 1:1 via Cashfree) built, deployed live, and **verified with a sandbox payment (2026-07-22)**. Phases 2–6 pending. Payment UI uses Cashfree **Drop-in** (`checkout({ redirectTarget: "_modal" })`), not embedded elements.
**Scope:** The data model, RLS posture, admin settings, and Cashfree edge-function scaffolding that every paid/subscription flow (Workflows 2 & 3) will build on. UI flows are explicitly out of scope here.

---

## Decisions locked (from review)

| Topic | Decision |
|---|---|
| Payment gateway | **Cashfree** (India). PG *Orders* API for one-time charges; *Subscriptions* (UPI e-mandate) for auto-renew. |
| Plus plans | **Admin-managed dynamic pricing**. Both **monthly and yearly** plans. **Auto-renew** supported. |
| Plus free-session benefit | **2 free sessions per month**, shared pool across **offerings + events** — a mentor can flag either as Plus-eligible; the member picks any 2/month. |
| Quota reset | On the member's **renewal (anchor) date**. Quota is **always monthly** — a yearly subscriber still gets **2 per month** (24/yr, capped 2 per monthly window), not 2 per year. |
| Mentor payout — Plus-consumed | Mentor earns a **configurable % of their list price** for a Plus-consumed session/event (admin-set `plus_payout_percent`). |
| Mentor payout — paid 1:1 | Mentor earns **price − admin-set % commission** (`commission_percent`). |
| Withdrawals | Earnings accrue to a ledger → mentor requests withdrawal → admin receives request → admin **pays manually** to the mentor's stored payout address and records a reference. |
| Currency | **INR** only for v1. |

---

## Conventions this foundation follows (hard-won from this repo's history)

1. **RLS is never auto-enabled here.** There is *no* `rls_auto_enable` event trigger (verified). Multiple past incidents came from tables created *with* policies but with RLS left off, leaving `GRANT ALL` to anon (legacy tables; the program tables fixed in `20260722120000`). **Every new table below explicitly `ENABLE ROW LEVEL SECURITY` and ships policies.** These are financial tables, so default-deny is the baseline.
2. **User FKs reference `public.users(id)`** (matches `mentorship_offerings`, `mentee_favorites`), which itself cascades from `auth.users`. Every FK gets an explicit `ON DELETE` action so `admin-manage-user`'s `auth.admin.deleteUser()` never fails on a dangling constraint (the H1 lesson). Operational rows use `CASCADE`; financial-audit rows (`mentor_earnings`, `withdrawal_requests`) use `SET NULL` on `mentor_id` to preserve history.
3. **Anon cannot call `has_role()`** (deliberately revoked, migration `20260516151559`). Any publicly-readable data (e.g. the pricing page) is served through a `SECURITY DEFINER` RPC, not a table policy that calls `has_role`.
4. **Secrets never touch the client.** Cashfree keys live only in edge-function secrets; the client only ever receives a `payment_session_id`.
5. **Payment status is written by exactly one path** — the signature-verified webhook (service role). No table below grants INSERT/UPDATE on money columns to `authenticated`.

---

## Admin monetization settings

New single-row config table `payment_settings` + a **"Payments" tab** in `AdminSettings.tsx` (mirrors `LeaderboardSettings` / `ApplicationPolicySettings`).

```
payment_settings
  id                  uuid pk default gen_random_uuid()   -- singleton row
  commission_percent  numeric not null default 20         -- paid 1:1: mentor gets price*(1-this/100)
  plus_payout_percent numeric not null default 50         -- plus-consumed: mentor gets list_price*(this/100)
  currency            text not null default 'INR'
  updated_by          uuid references public.users(id) on delete set null
  updated_at          timestamptz not null default now()
```
RLS: SELECT admin only; UPDATE admin only. (Defaults above are placeholders for admin to set.)

---

## New tables

Each table below: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()` unless noted. All have **RLS enabled**.

### `payments` — every Cashfree transaction
```
user_id                     uuid not null references public.users(id) on delete cascade
kind                        text not null check (kind in ('session','event','addon','subscription'))
reference_id                uuid           -- offering / event / addon / plan id (by kind)
session_id                  uuid references public.sessions(id) on delete set null  -- set once created
cashfree_order_id           text unique
cashfree_payment_session_id text
amount                      numeric not null
currency                    text not null default 'INR'
status                      text not null default 'created'
                              check (status in ('created','pending','paid','failed','refunded'))
payload                     jsonb          -- raw Cashfree order/webhook echo
updated_at                  timestamptz default now()
```
**RLS:** SELECT `user_id = auth.uid()` OR admin. **No** INSERT/UPDATE for `authenticated` (service role only).

### `subscription_plans` — admin-managed, dynamically priced
```
name           text not null
slug           text not null unique
interval       text not null check (interval in ('month','year'))
price          numeric not null
currency       text not null default 'INR'
monthly_quota  int not null default 2       -- free sessions per monthly window
benefits       jsonb                        -- display list; not enforcement
cashfree_plan_id text
is_active      boolean not null default true
updated_at     timestamptz default now()
```
**RLS:** admin full write; SELECT for `authenticated` where `is_active OR has_role(admin)`. Public/anon pricing via `SECURITY DEFINER` RPC `list_active_plans()`.
Seed: one `month` + one `year` plan (placeholder prices, admin edits).

### `memberships` — per-user Plus state
```
user_id               uuid not null references public.users(id) on delete cascade
plan_id               uuid references public.subscription_plans(id) on delete set null
status                text not null check (status in ('pending','active','past_due','cancelled','expired'))
cashfree_subscription_id text
started_at            timestamptz
current_period_start  timestamptz          -- billing window
current_period_end    timestamptz
quota_anchor_day      int                  -- day-of-month for the monthly quota reset (from started_at)
auto_renew            boolean not null default true
cancel_at_period_end  boolean not null default false
updated_at            timestamptz default now()
```
Unique **partial** index: one non-terminal membership per user (`status in ('pending','active','past_due')`).
**RLS:** SELECT own OR admin; writes service role/admin.

### `plus_session_usage` — the "2/month free" ledger + accrual basis
```
membership_id      uuid not null references public.memberships(id) on delete cascade
user_id            uuid not null references public.users(id) on delete cascade   -- denormalized for RLS
kind               text not null check (kind in ('session','event'))
reference_id       uuid not null        -- session id / event participant id
mentor_id          uuid references public.users(id) on delete set null
list_price         numeric not null     -- snapshot at consumption
accrued_amount     numeric not null     -- plus_payout_percent * list_price at consumption
quota_period_start date not null
quota_period_end   date not null
```
**RLS:** SELECT `user_id = auth.uid()` OR `mentor_id = auth.uid()` OR admin; writes service role only.
**Quota rule:** count rows for the membership where `now()` ∈ `[quota_period_start, quota_period_end)` must be `< plan.monthly_quota`.

### `mentor_earnings` — every mentor credit
```
mentor_id           uuid references public.users(id) on delete set null
source              text not null check (source in ('paid_session','plus_session','plus_event','adjustment'))
reference_id        uuid                 -- session / event / payment id
gross_amount        numeric not null     -- price the mentee's booking was worth
fee_amount          numeric not null default 0   -- platform's cut
net_amount          numeric not null     -- what the mentor earns
currency            text not null default 'INR'
status              text not null default 'accrued' check (status in ('accrued','withdrawn','reversed'))
withdrawal_request_id uuid references public.withdrawal_requests(id) on delete set null
```
**RLS:** SELECT `mentor_id = auth.uid()` OR admin; writes service role only.
**Balance** = `sum(net_amount) where status = 'accrued'`.

### `mentor_payout_accounts` — where a mentor gets paid (sensitive)
```
mentor_id  uuid not null unique references public.users(id) on delete cascade
method     text not null check (method in ('upi','bank'))
details    jsonb not null       -- {upi_id} | {account_no, ifsc, holder_name}
updated_at timestamptz default now()
```
**RLS:** SELECT/INSERT/UPDATE own; admin SELECT (to pay). No anon.

### `withdrawal_requests` — mentor asks, admin pays manually
```
mentor_id               uuid references public.users(id) on delete set null
amount                  numeric not null
status                  text not null default 'requested'
                          check (status in ('requested','approved','paid','rejected'))
payout_account_snapshot jsonb        -- address captured at request time
admin_note              text
payment_reference       text         -- filled when admin marks paid
requested_at            timestamptz not null default now()
processed_at            timestamptz
processed_by            uuid references public.users(id) on delete set null
```
**RLS:** mentor SELECT/INSERT own; admin SELECT/UPDATE all.

### Column additions
```
alter table public.mentorship_offerings add column plus_eligible boolean not null default false;
alter table public.events              add column plus_eligible boolean not null default false;
```

---

## Edge functions (scaffolding)

Secrets: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_WEBHOOK_SECRET`, `CASHFREE_ENV` (`sandbox`→`production`).

| Function | verify_jwt | Role |
|---|---|---|
| `cashfree-create-order` | true | Authenticated user starts a one-time charge (paid session / event / addon). Validates the item, computes amount server-side, inserts a `payments` row (service role), creates the Cashfree order, returns `payment_session_id`. |
| `cashfree-create-subscription` | true | Starts a Plus subscription for a plan → Cashfree subscription + `memberships` row `pending`. |
| `cashfree-webhook` | **false** | Cashfree → us. **Signature-verified**, idempotent per event id. The *only* writer of paid status: marks `payments.paid`; for `session` creates the `sessions` row + `mentor_earnings(paid_session)`; for `subscription` activates/renews the membership (extends period) or flips `past_due` on failure. |
| `book-plus-session` | true | Free Plus booking does **not** hit Cashfree. This function enforces quota **atomically** (service role, single transaction): active membership? item `plus_eligible`? usage in current monthly window `< monthly_quota`? → create session / event registration, insert `plus_session_usage` (`list_price`, `accrued_amount`), insert `mentor_earnings(plus_session|plus_event)`. Prevents client-side over-consumption / races. |

`config.toml`: add `verify_jwt = false` under `[functions.cashfree-webhook]`; the create-* and `book-plus-session` functions keep the default (`true`).

---

## Quota window logic (monthly, even for yearly plans)

`monthly_quota` comes from the plan (2 for both intervals). The **quota window is always one month**, anchored to `memberships.quota_anchor_day`:

- `window_start` = most recent anchor-day on/before `now()`; `window_end` = next anchor-day.
- Consume iff `count(plus_session_usage in [window_start, window_end)) < monthly_quota`.
- Monthly plan: billing window == quota window. Yearly plan: billing window is 12 months, but the quota window still rolls monthly → 2 free every month for the whole year.

---

## Rollout order (foundation phase)

1. `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts` (baseline from live).
2. Migration: `payment_settings` (+ seed singleton) & `subscription_plans` (+ `list_active_plans()` RPC + seed month/year).
3. Migration: `payments`.
4. Migration: `memberships` + `plus_session_usage`.
5. Migration: `mentor_earnings` + `mentor_payout_accounts` + `withdrawal_requests`.
6. Migration: `plus_eligible` columns on `mentorship_offerings` + `events`.
7. Every migration: explicit `ENABLE ROW LEVEL SECURITY` + policies + `ON DELETE` actions.
8. Edge-function scaffolding + `config.toml` `verify_jwt` settings + set Cashfree secrets (sandbox).
9. Regenerate `types.ts` again.

> Migrations are **not** applied to the live DB in this phase — they're written and reviewed, then pushed deliberately (the live project has ~300 real users; financial-schema changes are costly to reverse).

---

## Assumptions to confirm before writing migrations

1. **Commission/plus-payout percentages live in a new `payment_settings` table + a Payments tab in admin** (vs. bolting onto `branding`). Recommended as written — matches the per-domain settings pattern.
2. **INR-only** for v1 (no multi-currency).
3. **One active Plus membership per user** (the partial unique index) — no stacking plans.
4. `mentor_earnings`/`withdrawal_requests` keep `mentor_id` on `SET NULL` (preserve financial history if a user is deleted) rather than cascading the rows away.

---

## Build notes — what the foundation migrations added beyond the spec

The migrations (`20260722140000`–`20260722180000`) implement the model above, with two justified additions surfaced while building:

1. **`events.plus_price`** (`numeric default 0`) — events carry no intrinsic price, but a Plus-consumed event still owes the mentor an accrual (`plus_payout_percent × value`). `plus_price` is that notional basis, set by the mentor when flagging an event Plus-eligible.
2. **Atomic consumption in the DB, not the edge function** — two SQL functions in `20260722170000`:
   - `plus_quota_window_start(anchor_day, today)` → the current monthly quota window start (anchor clamped to month length).
   - `consume_plus_session(...)` (`SECURITY DEFINER`, service-role only) → **locks the membership row (`FOR UPDATE`)**, re-checks the monthly count, then writes `plus_session_usage` + `mentor_earnings` in one transaction. The row lock is what actually prevents two concurrent bookings from both passing the quota check — client-side or edge-only checks cannot guarantee this.

**Edge functions** live in `supabase/functions/`: `cashfree-create-order`, `cashfree-create-subscription`, `cashfree-webhook`, `book-plus-session`; all four wired `verify_jwt = false` in `config.toml` (user-facing ones verify the JWT internally; the webhook verifies the Cashfree HMAC signature).

**Scaffold limits (finished with their flows, not now):**
- `cashfree-create-order` handles `kind='session'` only; `event`/`addon` amount resolution comes with those flows.
- `book-plus-session` handles `kind='session'` only; the `event` branch returns `501` until the `event_participants` insert + `events.plus_price` wiring lands with the events booking flow.
- `cashfree-create-subscription` uses the documented Subscriptions request shape but the exact mandate-authorization redirect and Cashfree plan setup are finalized against the sandbox.

**Not done in this phase (deliberately):** no migration pushed to live; `types.ts` not regenerated (happens post-push); no frontend/UI; Cashfree secrets not set. A withdrawal request's amount-vs-balance check is enforced by its flow later (the RLS insert policy only guarantees a mentor can request for themselves).
