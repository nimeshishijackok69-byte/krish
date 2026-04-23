# Test Run Log

Date: 2026-04-23
Workspace: `C:\Users\Admin\Downloads\FLOW AGENT`

## Scope

Ran the requested checks from the bottom of `TESTING.md` in this order:

1. Section `11` Security Checks
2. Section `10` Other Features

Backend was run with the seeded in-memory test server on `http://localhost:5001`.
Frontend was built successfully and Vite was available on `http://localhost:5173`.

## What I Found

### Section 11: Initial failures

- `Non-existent user rejected`
  Result before fix: returned `401 Invalid credentials`
  Expected: `404 User not found`

- `Functionary can't use password login`
  Result before fix: returned `401 Invalid credentials`
  Expected: `403` with OTP-only behavior

- `Password not returned in API responses`
  Result before fix: `/api/v1/users` leaked raw `passwordHash`

- `Branching: hidden fields not submitted`
  Result before fix: hidden fields like `m1` were stored even when `b1=Science`

- `Audit logs track logins with IP`
  Result before fix: backend stored metadata, but frontend expected a different shape and would not render the details cleanly

### Section 10: Initial failures or mismatches

- `10.1 Analytics`
  Result before fix: frontend expected `forms`, `completionRate`, `avgScore`, `submissionTimeline`, `scoreDistribution`, `nominationsByStatus`, and `schoolCodes`, but backend `/stats` did not return them

- `10.2 Email Templates`
  Result before fix: frontend used `/email-templates`, but backend had no route for it

- `10.3 Audit Logs`
  Result before fix: filter and detail rendering were mismatched with backend payload shape

- `10.4 Exports`
  Risk before fix: user export would have included password hashes because `/users` leaked them

- `10.5 User Management`
  Result before fix: backend user normalization was inconsistent with frontend field names, and update behavior could blank profile fields

## What I Changed

### Backend

- `backend/src/controllers/auth.ts`
  Added school-code extraction fallback from functionary email
  Changed missing-user login to `404`
  Blocked functionary password login with `403`
  Normalized `school_code` in auth responses

- `backend/src/controllers/users.ts`
  Rewrote user normalization to return safe frontend-ready fields only
  Removed password hash exposure from user responses
  Mapped create/update payloads into `profile.*`
  Preserved existing profile data on partial updates

- `backend/src/controllers/submissions.ts`
  Added server-side filtering so only visible branching fields are stored
  Normalized submission list responses to expose score percentage cleanly

- `backend/src/controllers/stats.ts`
  Expanded `/stats` response to include analytics payload used by the admin page

- `backend/src/controllers/audit.ts`
  Normalized audit-log payload shape for frontend consumption
  Added action filtering support

- `backend/src/models/EmailTemplate.ts`
- `backend/src/controllers/emailTemplates.ts`
- `backend/src/routes/emailTemplates.ts`
- `backend/src/app.ts`
  Added admin-only email-template CRUD with built-in OTP/invite/confirmation/reminder templates

- `backend/src/controllers/forms.ts`
- `backend/src/controllers/reviews.ts`
  Fixed query typing and normalization issues needed for clean builds

### Frontend

- `frontend/src/components/FormRenderer.tsx`
  Added `visibleIf` support for section/field visibility
  Improved quiz scoring compatibility with backend `marks` / numeric `correct` values

- `frontend/src/pages/FormView.tsx`
  Passed section `visibleIf` rules through to the renderer
  Normalized quiz time-limit settings for read-only views

- `frontend/src/pages/FormFill.tsx`
  Added optional `_id` typing for form payload compatibility

## Verification After Fixes

### Section 11

Verified passing after changes:

- Wrong password returns `401`
- Non-existent user returns `404`
- Functionary password login returns `403`
- Wrong OTP returns `401`
- Functionary OTP request returns school code `KV001`
- JWT contains `exp`
- `/users` no longer leaks password hash
- Audit logs now expose IP details in the frontend-friendly shape
- Branching submission now stores only visible field IDs

### Section 10

Verified passing after changes:

- `/stats` now returns the analytics payload needed by the page
- `/email-templates` now returns built-in templates and supports create/update/delete
- `/audit-logs?action=login` returns filtered login audit entries
- User create/update/delete works with normalized frontend fields
- Backend and frontend both build successfully

## Remaining Notes

- I could not use the local `agent-browser` CLI because it was not installed in this environment, so section `10` UI verification was completed through:
  API verification
  source-path checks
  successful frontend/backend production builds

- The larger Email Center page still references additional endpoints such as `/smtp-config`, `/email-logs`, and `/reminder-schedules` that are not yet implemented in this backend. The requested `Email Templates` portion is now implemented and verified.
