# Production Readiness Checklist

A living checklist for shipping Mentorle to production. Tick items as they're completed.

---

## 1. Security

- [x] No private keys in frontend (`.env` only has `VITE_*` publishable values)
- [x] `SUPABASE_SERVICE_ROLE_KEY` only in edge function secrets
- [x] RLS enabled on all `public` tables (auto-enforced by `rls_auto_enable` event trigger)
- [x] Roles stored in `user_roles` with `has_role()` security-definer function
- [x] `validate-jwt-config` edge function verifies caller + admin role
- [ ] Audit `approve-mentor-application` for the same auth pattern
- [x] `mentor-resumes` bucket is private; `branding-assets` bucket has admin-only write RLS
- [x] Security headers configured in `vercel.json` (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP)
- [ ] Run `security--run_security_scan` and resolve findings
- [ ] Run `supabase--linter` and resolve warnings

## 2. Performance

- [x] Route-level code splitting via `React.lazy()` + `<Suspense>`
- [x] React Query defaults tuned (`staleTime`, `gcTime`, `refetchOnWindowFocus: false`)
- [x] Vite manual chunks for `react`, `radix`, `supabase`, `recharts`
- [x] `<link rel="preconnect">` to Supabase URL in `index.html`
- [ ] Add `loading="lazy" decoding="async"` to non-hero images
- [ ] Run `npm run build` and inspect bundle sizes (consider `rollup-plugin-visualizer`)

## 3. State management

- [x] Auth state via `AuthContext`
- [x] Branding state via `BrandingContext`
- [ ] Migrate page data fetching from `useEffect + useState` to `useQuery` (start: `MentorDirectory` ✅, then `AdminUsers`, `AdminApplications`)
- [ ] Migrate forms to `react-hook-form` + `zod` (`MentorApplicationForm`, `BookSession`)

## 4. Error handling & resilience

- [x] Top-level `<ErrorBoundary>` in `App.tsx`
- [x] `<Suspense>` fallback for lazy routes
- [x] Standardized Supabase error helper (`src/lib/handleError.ts`)
- [x] React Query `QueryCache` / `MutationCache` global error handlers

## 5. Observability

- [ ] Wire Sentry behind `VITE_SENTRY_DSN` (requires DSN)
- Edge function logs: Supabase Dashboard → Functions → `<name>` → Logs

## 6. Vercel / hosting

If migrating from Lovable hosting to Vercel:
- [x] `vercel.json` with SPA rewrites + security headers + `cleanUrls`
- Build command: `npm run build`, output dir: `dist`
- Env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (Production + Preview). **Never** add the service role key.
- Update Supabase Auth → URL Configuration → Site URL + Redirect URLs to match production domain
- `robots.txt` allows production, disallows previews

## 7. SEO / metadata

- [ ] Replace OG image with production asset (currently a Lovable preview)
- [ ] Set `meta name="author"` to your org
- [x] `<link rel="canonical">` in `index.html`

## 8. Code structure ("microservices" equivalent)

- [x] Feature folder convention started under `src/features/{feature}/{api,hooks,components}`
- [x] Mentors slice migrated as the template (`src/features/mentors`)
- [ ] Migrate remaining features (`auth`, `sessions`, `admin`, `branding`) incrementally
- Edge functions stay small and single-purpose (one concern per function)

## 9. CI / quality gates

Recommended GitHub Action steps (not yet committed — ask before adding):
- `npm ci`
- `npm run lint`
- `tsc --noEmit`
- `npm run test`
- `npm run build`
- `! grep -r "SERVICE_ROLE" src/` (fail if matched)

## 10. Auth / config sanity

- [x] `AuthContext` defers profile fetch with `setTimeout(..., 0)` to avoid auth deadlock
- [ ] Supabase Auth dashboard: Site URL = prod domain
- [ ] Supabase Auth dashboard: Redirect URLs include prod + `http://localhost:8080`
- [x] OTP length = 8 (matches `config.toml`)
- [ ] Decide whether to disable Supabase email signup (mentees enter via JWT)
