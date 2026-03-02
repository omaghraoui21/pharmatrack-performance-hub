# PharmaTrack Performance — Project Overview

## Purpose

Internal web app for a pharmaceutical company to track daily operator events (GMP incidents, HSE behaviors, deviations, attendance, flexibility, versatility, productivity) and compute an annual score with ranking.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — Auth, Postgres DB, Edge Functions, Storage
- **State**: TanStack React Query for server state, React Context for auth
- **Routing**: react-router-dom v6 with protected routes

## Architecture

```
src/
├── App.tsx                    # Routes definition (all wrapped in ProtectedRoute + AppLayout)
├── contexts/AuthContext.tsx   # Auth state, profile, appRoles, signIn/signUp/signOut
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # SidebarProvider + main content wrapper
│   │   └── AppSidebar.tsx     # Navigation sidebar with role-filtered menu items
│   ├── auth/ProtectedRoute.tsx # Auth guard, optional `requireManager` prop
│   ├── settings/
│   │   ├── UsersTab.tsx       # CRUD for user management (invite, edit, roles)
│   │   ├── ReferentialsTab.tsx # Manage event_types, units, lines, shifts
│   │   └── AssignmentsTab.tsx  # Supervisor-operator assignments
│   └── ui/                    # shadcn components
├── pages/
│   ├── Login.tsx              # Email/password auth
│   ├── Dashboard.tsx          # KPI dashboard
│   ├── Operators.tsx          # Operator list + CRUD
│   ├── NewEvent.tsx           # Create new event for an operator
│   ├── Validation.tsx         # Manager approves/rejects pending events
│   ├── Import.tsx             # CSV/Excel import of monthly data
│   ├── Scoring.tsx            # Scoring grid configuration
│   ├── Ranking.tsx            # Annual operator ranking (score100/note20)
│   ├── HierarchyRanking.tsx   # Supervisor & manager ranking
│   ├── Objectives.tsx         # Personal objectives management
│   ├── Settings.tsx           # Profile, Users, Positions, Referentials, Assignments tabs
│   └── NotFound.tsx
├── integrations/supabase/
│   ├── client.ts              # Auto-generated, DO NOT EDIT
│   └── types.ts               # Auto-generated, DO NOT EDIT
└── hooks/, lib/               # Utilities
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (id = auth.users.id). Columns: email, full_name, role (supervisor\|manager), unit_id, is_active, manager_profile_id |
| `user_roles` | App-level roles (many-to-many). Columns: user_id, role (app_role enum) |
| `operators` | Factory floor operators. Columns: matricule, full_name, unit (text), is_active |
| `events` | Daily events recorded for operators. Columns: operator_id, event_type_id, event_date, status (pending\|approved\|rejected), created_by, validated_by, etc. |
| `event_types` | Reference table for event categories. Columns: code, label, category (event_category enum), points, requires_description |
| `units` | Organizational units (e.g., production lines) |
| `lines` | Production lines within units |
| `shifts` | Work shifts (A, B, C, etc.) |
| `positions` | Job positions for operator versatility tracking |
| `operator_positions` | Many-to-many: operators ↔ positions |
| `supervisor_operator_map` | Assigns supervisors to operators (start_date, end_date) |
| `objectives` | Personal objectives with target/actual values and scoring |

### Enums

- `user_role`: `supervisor`, `manager`
- `app_role`: `super_admin`, `admin_site`, `manager_unite`, `superviseur`, `readonly`
- `event_category`: `gmp`, `hse`, `comportement`, `flexibilite`, `assiduite`, `bonus`, `polyvalence`, `productivite`
- `event_status`: `pending`, `approved`, `rejected`

### Key Database Functions

- `has_role(_user_id, _role)` — SECURITY DEFINER, checks user_roles table
- `is_manager_or_above(_user_id)` — Returns true if user has super_admin, admin_site, or manager_unite role, OR profiles.role = 'manager'
- `get_year_ranking(p_year, p_unit_id?)` — Computes operator annual scores (base 80, daily bonus capped at 1.5, malus uncapped, polyvalence bonus)
- `get_supervisor_ranking(p_year, p_unit_id?)` — Ranks supervisors based on team avg score, pending events, validation delay
- `get_manager_ranking(p_year)` — Ranks managers based on unit performance
- `handle_new_user()` — Trigger on auth.users INSERT → creates profiles row
- `update_updated_at_column()` — Generic trigger for updated_at timestamps

### RLS Policies Summary

- **profiles**: Everyone can SELECT. Users can UPDATE own. Managers (is_manager_or_above) can UPDATE any.
- **user_roles**: Users can see own + managers can see all. Managers can INSERT/UPDATE/DELETE. Super_admin has full ALL.
- **events**: Anyone authenticated can SELECT all and INSERT (own). Managers can UPDATE.
- **operators, positions, event_types, lines, shifts, operator_positions**: Everyone can SELECT. Managers can manage (INSERT/UPDATE/DELETE).
- **supervisor_operator_map**: Everyone can SELECT. Managers (is_manager_or_above) can manage.
- **objectives**: Users see/manage own. Managers can see/update all. Managers can DELETE.

## Authentication & Authorization

### Dual Role System

1. **Legacy role** (`profiles.role`): `supervisor` or `manager` — used for basic route guarding and navigation filtering
2. **App roles** (`user_roles` table): Granular permissions — `super_admin`, `admin_site`, `manager_unite`, `superviseur`, `readonly`

### AuthContext provides:
- `user`, `session`, `profile`, `appRoles`, `loading`
- `isManager` (profiles.role === 'manager'), `isSupervisor`, `isSuperAdmin`
- `hasRole(role)` — checks appRoles array
- `signIn`, `signUp`, `signOut`

### Route Protection
- `<ProtectedRoute>` — requires authenticated user
- `<ProtectedRoute requireManager>` — requires profiles.role === 'manager'

## Edge Functions

### `invite-user`
- **POST** with body: `{ email, full_name, role, app_roles[], unit_id }`
- Requires Authorization header from a manager_or_above user
- Uses service_role to call `auth.admin.createUser()` with random password
- Auto-creates profile (via DB trigger), updates unit_id, inserts app_roles

### `seed-demo-users`
- Creates 5 demo accounts for testing (password: `Demo1234!`):
  - superadmin@demo.com (super_admin)
  - adminsite@demo.com (admin_site)
  - manager@demo.com (manager_unite)
  - superviseur@demo.com (superviseur)
  - readonly@demo.com (readonly)

## User Management (Settings > Utilisateurs)

The `UsersTab` component provides full CRUD:
- **List** all profiles with their app_roles and unit
- **Invite** new users via the invite-user edge function
- **Edit** profile info (full_name, unit_id, is_active)
- **Manage roles** — add/remove app_roles per user
- **Toggle active status**

Only visible to users where `isManager === true`.

## Scoring System

- Base score: **80/100** per operator per year
- Daily events: bonus capped at **+1.5/day**, malus uncapped
- Polyvalence bonus: **(positions_count - 2) × 0.5** if > 2 positions
- Final: `score100 = clamp(0, 100, 80 + event_points + polyvalence_bonus)`
- `note20 = score100 / 5`

## Storage

- Bucket `event-attachments` (public) — for event file uploads

## Files You Must NOT Edit

- `src/integrations/supabase/client.ts` — auto-generated
- `src/integrations/supabase/types.ts` — auto-generated
- `supabase/config.toml` — auto-managed
- `.env` — auto-managed (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID)

## Known Gaps / TODO

- No email notification when a user is invited (password is random, no reset flow triggered)
- `readonly` role has no specific UI restrictions yet (navigation/actions not filtered by app_role)
- Navigation filtering uses legacy `profiles.role` only, not `app_roles`
- No audit log for admin actions
- Manager_profile_id column exists on profiles but is not used in UI
- The `operators.unit` column is text (not FK to units.id) — legacy design
