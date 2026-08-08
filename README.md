# Shift Master Pro

Build a complete, production-ready full-stack web application for employee shift scheduling. This is not a prototype — implement every feature below fully and correctly the first time, including validation, edge cases, and empty states. The entire user-facing interface (all text, labels, buttons, dates, error messages, toasts, empty states) must be in Hebrew, with full RTL (right-to-left) layout applied consistently across every screen, form, table, and modal. Use Supabase as the backend (auth + Postgres database) with Row Level Security so employees can only edit their own data and only admins can edit shifts, conflict rules, and projects.

1. Authentication / Login

On first visit, show a simple login screen asking for: Full Name (first + last name, as two separate fields: first name + last name) and Phone Number (validate as a valid Israeli phone number format, digits only, show inline Hebrew validation error if invalid).

No password required for employees — this acts as a lightweight identity check.

Matching logic: match existing employees by first name + last name (case-insensitive, trimmed whitespace) AND phone number together. If both match an existing record, log into that profile. If the name matches but the phone number is different, show a Hebrew warning ("employee with this name already exists with a different phone number — contact the admin") rather than silently creating a duplicate. If nothing matches, create a new employee profile.

Store the session in a persistent cookie/local session so the user isn't asked again until they explicitly log out. Add a visible "Log out" / "Switch user" option in the UI (e.g., in a menu or profile icon) — this is the only way to log out.

Add a separate Admin Login (email + password, standard Supabase auth) reachable via a distinct /admin route or a small "Admin" link that is not prominent on the main employee screen. Admin accounts are created manually/seeded, not via public signup.

If an admin is logged in, never show them the employee name/phone entry screen — route them straight to the Admin Dashboard.

2. Employee — Calendar View

After login, show a monthly calendar view (like a phone's native calendar app) with the current month displayed by default, Hebrew month/day names, weeks starting Sunday, and arrows/swipe to navigate to next/previous months. Include a "today" button to jump back to the current month.

Each day cell shows a compact indicator of how many shifts exist that day and whether the employee is already signed up for one (e.g., a colored dot or badge). If a day has no shifts, it should look visibly empty/inactive, not throw an error.

Tapping a day opens a detail view (modal or side panel) listing all shifts for that day, each showing:

Shift time range

Current number of people signed up vs. min/max required (e.g., "2/4 people, minimum 2")

A visual state: open (needs people), filling, full, or "you're signed up" (highlighted differently, e.g., green, with a "Cancel signup" option instead of the signup button)

A "Sign up for this shift" button

When an employee signs up for a shift, register them under their employee profile (not just free text) so it links to their id.

Allow an employee to cancel their own signup before the shift starts (remove them from the shift, free up a capacity slot). Do not allow cancellation after they've pressed "Start Shift."

Conflict rule enforcement: Before allowing signup, check the admin-defined "cannot work together" pairs/groups for that specific shift. If a blocked colleague is already signed up for that same shift, disable/block the signup button and show a clear Hebrew message (e.g., "You cannot join this shift due to a scheduling conflict") without necessarily naming which colleague, since that may be sensitive.

Enforce the shift's max capacity strictly (disable signup and show "Shift is full" once max is reached) and show min capacity as a visual "needs more people" indicator when below minimum. Perform this capacity check atomically on the backend (e.g., a database transaction or constraint), not only client-side, to prevent two people exceeding capacity by signing up at the same instant.

3. Employee — Shift Actions & Notes

For any shift the employee is signed up for, on the day of that shift only (compare to today's date), show two buttons: "Start Shift" (התחל משמרת) and "End Shift" (סיים משמרת). "End Shift" is disabled/hidden until "Start Shift" has been pressed. Once "End Shift" is pressed, both buttons disable and show a "completed" state with the actual worked duration displayed (e.g., "worked 4h 15m").

Record real timestamps for both actions in the database. Calculate actual worked hours as (end_actual_ts − start_actual_ts), not the scheduled shift length — this actual duration is what feeds the admin's hours counter.

Handle the case where an employee forgets to press "End Shift": show it as "in progress" to the admin, and let the admin manually close it out with an editable end time (see Admin section).

Allow the employee to add a free-text note to a shift they worked (e.g., "worked 2 extra hours", schedule change, etc.), editable by the employee until the shift day ends. Notes are timestamped and linked to that employee + that shift/day, and remain visible to the employee afterward (read-only) so they can see their own history.

Give employees a simple "My Shifts" / history view listing past shifts they worked with actual hours and their notes, in addition to the calendar.

4. Employee — Personal Page (Projects)

Each employee has a personal page showing the list of projects assigned to them by the admin, displayed as a queue but with only the current active project shown prominently (name, description, and any attached details/notes from the admin).

A "Finished Project" (סיימתי פרוייקט) button marks the current project complete (with a completion timestamp) and automatically advances the employee to the next project in their assigned order.

If there is no next project, show a clear Hebrew empty state (e.g., "No projects currently assigned — waiting for the admin to add more") instead of a blank/broken screen.

Below the current project, show a collapsed/secondary list of previously completed projects for that employee (read-only history, with completion dates).

5. Admin Dashboard

Full calendar view of the month showing all shifts and who is signed up for each (same month navigation as the employee view), with a daily summary view (click a day) showing exactly who worked which shift that day, their actual start/end times, hours worked, and any notes they left.

Create/Edit/Delete Shifts: When creating or editing a shift, the admin sets:

Date and time range (shift start/end hours)

Minimum number of people required

Maximum number of people allowed (validate max ≥ min)

Which conflict rules apply to this shift (select from existing global "conflict rules," see below)

Deleting a shift that already has signups should ask for confirmation and cleanly remove the signups too.

Support creating recurring shifts if practical (e.g., "repeat this shift every day this week" or a simple duplicate-to-multiple-dates option) — if this is too complex to build reliably, at minimum make it fast to duplicate an existing shift to a new date.

Conflict Rules Manager: A dedicated screen listing all defined "cannot work together" pairs (select Employee A + Employee B from a dropdown of existing employees), with the ability to add and delete rules. These rules apply globally across all shift signups.

Employee Management: A table/list of all employees showing name, phone, and quick links to their assigned projects and shift history. Admin can edit an employee's name/phone and manually manage their signups (add/remove them from a shift, override a conflict/capacity block if truly necessary, and manually fix a shift's start/end time if the employee forgot to press the button) — except the total hours counter itself is always system-calculated from actual start/end timestamps and never a manually-typed number.

Hours Counter: For each employee, show a running total of actual hours worked in the selected month (sum of all completed shifts' actual duration), as a sortable table (name → total hours), with a month selector to view any past or current month. Include a visual flag for shifts still "in progress" (started but not ended) so the admin notices incomplete data.

Project Assignment: Admin can create projects (name + description) and assign an ordered list of them to each employee. Admin can view every employee's current project and their full completed-project history with completion dates. Admin can reorder or remove projects from an employee's queue.

Notes Review: Admin can view all notes employees added to their shifts in one place, filterable by employee, date range, or shift.

6. General Requirements

Interface must be simple, clean, and highly accessible — large tappable buttons, clear typography, mobile-first responsive design (most employees will use this on their phones).

Use a clean calendar/agenda UI pattern (similar to native mobile calendar apps).

All dates/times should respect Israel local time and Hebrew date formatting conventions (day/month/year).

Data must persist reliably (use the backend database, not local storage) since this is a real multi-user scheduling tool.

Ensure real-time or near-real-time updates so that shift capacity/signups reflect correctly when multiple employees are signing up around the same time (prevent race conditions on the min/max capacity check).

7. Suggested Data Model

Employees: id, full_name, phone, created_at

Admins: id, email, password_hash

Shifts: id, date, start_time, end_time, min_people, max_people

ShiftSignups: id, shift_id, employee_id, start_actual_ts, end_actual_ts, note

ConflictRules: id, employee_id_a, employee_id_b (or group-based structure)

Projects: id, name, description

EmployeeProjects: id, employee_id, project_id, order_index, status (assigned/completed), completed_at

8. Edge Cases & Empty States (implement all of these — do not skip)

No shifts this month → calendar renders normally with no dots, no error.

New employee with zero project history / zero completed shifts → friendly Hebrew empty states, not blank screens or console errors.

Employee tries to sign up for a shift that's already full, already conflicting, or already started/passed → button is disabled with a clear reason shown, not just a failed silent click.

Two employees pressing "sign up" on the last open slot at the same time → only one should succeed; the other sees "shift is now full."

Admin deletes a shift or employee that has related data (signups, hours, notes) → confirm before deleting, and cascade or safely handle related records instead of crashing.

Phone number field → basic format validation only, don't over-engineer.

Mobile viewport (this app will mostly be used on phones) → every screen (calendar, admin dashboard, tables) must be fully usable on a small screen, including horizontal scrolling for any wide admin tables.

9. Non-Functional Requirements

Loading states (spinners/skeletons) for any data fetch, so the UI never appears frozen or blank.

Toast/inline confirmation messages in Hebrew for every action (signup succeeded, shift started, note saved, project marked complete, etc.).

Consistent color coding: e.g., green = signed up/completed, gray = open/available, red = full or blocked, yellow/orange = in progress.

Use a clean, modern, accessible design system (large touch targets, readable font sizes, good contrast) — Loveable's default component library (shadcn/ui style) is fine, just make sure RTL is applied correctly to it (text alignment, icon direction, spacing).

Build this as one complete working application in this first pass — authentication (employee + admin), full calendar with shift signup, conflict and capacity enforcement (including race-condition safety), start/end shift with real hours tracking, employee notes, personal project queue, and the full admin dashboard (shift CRUD, conflict rules, employee management, hours counter, project assignment, notes review) — with all edge cases and empty states from section 8 handled, not left as follow-up work.

The admin route currently renders only a placeholder. The backend server functions for all admin operations already exist in src/lib/admin.functions.ts — inspect that file first and reuse those functions as-is; do not duplicate or rewrite backend logic that already exists there. If a function needed for something below is missing from that file, add it there following the same patterns/conventions already used in the file, then wire the UI to it.

Build the complete Admin Dashboard UI now, fully in Hebrew with RTL layout, matching the visual style already established on the employee side (same design system/components, same color coding conventions: green = signed up/completed, gray = open/available, red = full or blocked, yellow/orange = in progress).

1. Admin Shell

A distinct /admin area, only reachable after admin login (email + password via Supabase auth), completely separate from the employee name+phone flow.

A persistent admin navigation (sidebar or top tabs, RTL-correct) with sections: Calendar / Shifts, Conflict Rules, Employees, Hours Report, Projects, Notes.

Every section must have working loading states (skeletons/spinners) and empty states in Hebrew — never a blank or broken screen when there's no data yet.

2. Calendar / Shifts Section

Full month calendar (same navigation pattern as the employee calendar: month arrows, "today" button, Hebrew month/day names, weeks starting Sunday) showing all shifts and current signup counts per day.

Clicking a day opens a daily summary: every shift that day, who is signed up, their actual start/end timestamps and computed hours (once available), and any notes they left.

Create/Edit/Delete Shift form with: date, start time, end time, minimum people, maximum people (validate max ≥ min), and selection of which conflict rules apply to this shift.

Deleting a shift that already has signups must show a confirmation dialog and cleanly cascade-remove the related signups.

Add a fast "duplicate this shift to another date" action so the admin doesn't have to re-enter everything for repeat shifts.

Allow the admin to manually add/remove an employee from a shift's signups, and to override a conflict or capacity block if necessary (with a confirmation step, since it's an override).

Allow the admin to manually correct a shift's actual start/end time if an employee forgot to press Start/End Shift, and to see a clear visual flag for shifts that are still "in progress" (started, not ended).

3. Conflict Rules Section

A list of all existing "cannot work together" pairs (Employee A + Employee B, chosen from dropdowns/search over existing employees).

Add new rule / delete existing rule, with confirmation on delete.

Show, for each rule, a quick note of upcoming shifts where both employees are currently scheduled together if applicable that would need reconciling (nice-to-have, skip if not already supported by the backend functions without extra backend work).

4. Employees Section

Table/list of all employees: name, phone, quick links to their current project and their shift history.

Edit an employee's name/phone.

This is where the admin controls everything about a user except the hours counter, which is always system-calculated from actual start/end timestamps and never manually editable — do not add any input field that lets the admin type in a total hours number.

5. Hours Report Section

Sortable table: employee name → total actual hours worked in the selected month (sum of completed shifts' actual duration, i.e. end_actual_ts − start_actual_ts).

Month selector to view any past or current month.

Visual flag/indicator for employees who currently have a shift "in progress" (so the admin knows that month's total is not yet final).

6. Projects Section

Create/edit/delete projects (name + description).

Assign an ordered queue of projects to any employee; reorder or remove projects from an employee's queue.

View any employee's current active project and their full completed-project history with completion dates.

7. Notes Section

A single filterable view of all notes employees have left on their shifts, filterable by employee, date range, and/or shift.

8. Non-Functional Requirements (apply to every section above)

Full mobile responsiveness — admin will also use this from a phone, so every table needs to work on a small screen (horizontal scroll or stacked/card layout as appropriate).

Toast/inline confirmation messages in Hebrew for every create/edit/delete action.

Confirmation dialogs before any destructive action (delete shift, delete rule, delete project, remove employee from shift).

Reuse existing functions from src/lib/admin.functions.ts wherever they already cover the need — this is a wiring/UI task on top of an existing backend, not a rebuild.

Build all sections above completely and correctly in this one pass, including empty states, loading states, and confirmations — do not leave any section as a partial placeholder.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deployment to Netlify

This project is configured for deployment to Netlify. Follow these steps:

### Environment Variables

Before deploying, you need to set up the following environment variables in Netlify's Site Settings → Environment Variables:

- `VITE_SUPABASE_URL` / `SUPABASE_URL` - Your Supabase project URL (e.g., `https://your-project-id.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public API key
- `SUPABASE_RPC_SECRET` - Shared secret gating the employee-facing database functions (must match the value inserted into the `_app_secrets` table)
- `EMPLOYEE_SESSION_SECRET` - Random secret used to sign the employee login cookie

No service-role key is needed — the app never uses one. Admin operations run through the admin's own Supabase Auth session, and employee operations run through secret-gated database functions (see `supabase/migrations`).

### Build Configuration

The project uses the following build settings (configured in `netlify.toml`):

- **Build command**: `bun run build`
- **Publish directory**: `.output/public`

The `netlify.toml` file also includes SPA redirect rules to ensure client-side routing works correctly (e.g., refreshing on `/admin` won't 404).

### Deployment Steps

1. Connect your GitHub repository to Netlify
2. Add the environment variables listed above in Netlify's Site Settings → Environment Variables
3. Deploy - Netlify will automatically build and deploy your site

### Local Build Test

To test the production build locally:

```sh
bun run build
```

The build output will be in the `.output/public` directory.
