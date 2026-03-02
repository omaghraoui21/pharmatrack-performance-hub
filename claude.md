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
├── contexts/AuthContext.tsx   # Auth state, profile, appRoles, signIn/signOut
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # SidebarProvider + main content wrapper
│   │   └── AppSidebar.tsx     # Navigation sidebar with role-filtered menu items
│   ├── auth/ProtectedRoute.tsx # Auth guard with requiredRoles prop
│   ├── settings/
│   │   ├── UsersTab.tsx       # CRUD for user management (invite, edit, roles)
│   │   ├── ReferentialsTab.tsx # Manage event_types, units, lines, shifts
│   │   └── AssignmentsTab.tsx  # Hierarchy links + operator-to-supervisor assignments
│   ├── ErrorBoundary.tsx      # Global error boundary
│   └── ui/                    # shadcn components
├── hooks/
│   ├── useHierarchyScope.ts   # Returns visible operator IDs based on hierarchy cascade
│   └── use-mobile.tsx
├── pages/
│   ├── Login.tsx              # Email/password auth
│   ├── Dashboard.tsx          # KPI dashboard (filtered by hierarchy scope)
│   ├── Operators.tsx          # Operator list + CRUD
│   ├── NewEvent.tsx           # Create new event for an operator
│   ├── Validation.tsx         # Manager approves/rejects pending events (filtered by scope)
│   ├── Import.tsx             # CSV/Excel import of monthly data
│   ├── Scoring.tsx            # Scoring grid configuration
│   ├── Ranking.tsx            # Annual operator ranking (filtered by scope)
│   ├── HierarchyRanking.tsx   # Supervisor & manager ranking
│   ├── Objectives.tsx         # Personal objectives management
│   ├── Settings.tsx           # Profile, Users, Positions, Referentials, Assignments tabs
│   └── NotFound.tsx
├── integrations/supabase/
│   ├── client.ts              # Auto-generated, DO NOT EDIT
│   └── types.ts               # Auto-generated, DO NOT EDIT
└── lib/                       # Utilities
```

## Database

See **`database.md`** for complete schema, functions, RLS policies, and hierarchy model documentation.

### Quick Reference

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (id = auth.users.id) |
| `user_roles` | App-level roles (many-to-many) |
| `hierarchy_links` | N-level org chart (parent→child between profiles, N:N) |
| `operators` | Factory floor operators (no login) |
| `supervisor_operator_map` | Assigns profiles to operators (for visibility cascade) |
| `events` | Daily events recorded for operators |
| `event_types` | Event categories with point values |
| `units` / `lines` / `shifts` | Organizational referentials |
| `positions` / `operator_positions` | Job positions for polyvalence tracking |
| `objectives` | Personal objectives with scoring |

### Key Database Functions

- `has_role(_user_id, _role)` — checks user_roles table (SECURITY DEFINER)
- `is_manager_or_above(_user_id)` — checks for super_admin/admin_site/manager_unite or profiles.role='manager'
- `get_descendants(_profile_id)` — recursive traversal of hierarchy_links
- `get_visible_operator_ids(_profile_id)` — operators visible via self + descendants
- `get_year_ranking(p_year, p_unit_id?)` — annual operator scoring
- `get_supervisor_ranking(p_year, p_unit_id?)` — supervisor ranking
- `get_manager_ranking(p_year)` — manager ranking

## Authentication & Authorization

### Dual Role System

1. **Legacy role** (`profiles.role`): `supervisor` or `manager` — used for basic backward compat
2. **App roles** (`user_roles` table): Granular permissions — `super_admin`, `admin_site`, `manager_unite`, `superviseur`, `readonly`

### AuthContext provides:
- `user`, `session`, `profile`, `appRoles`, `loading`
- `isManager` (profiles.role === 'manager'), `isSupervisor`, `isSuperAdmin`
- `hasRole(role)` — checks appRoles array
- `signIn`, `signOut`

### Route Protection
- `<ProtectedRoute>` — requires authenticated user
- `<ProtectedRoute requiredRoles={['manager_unite', 'admin_site', 'super_admin']}>` — requires specific app_role

### Hierarchy-Based Data Filtering
- `useHierarchyScope()` hook provides `canSeeOperator(id)`, `visibleOperatorIds`, `isFullAccess`
- Managers+ (manager_unite, admin_site, super_admin) = full access, bypass hierarchy
- Others see only operators assigned to themselves or their descendants via `get_visible_operator_ids()`

## Scoring System

- Base score: **80/100** per operator per year
- Daily events: bonus capped at **+1.5/day**, malus uncapped
- Polyvalence bonus: **(positions_count - 2) × 0.5** if > 2 positions
- Final: `score100 = clamp(0, 100, 80 + event_points + polyvalence_bonus)`
- `note20 = score100 / 5`

## Edge Functions

| Function | Purpose |
|----------|---------|
| `invite-user` | POST — creates auth user + profile + roles (requires manager+ auth) |
| `seed-demo-users` | POST — creates 5 demo accounts (password: `Demo1234!`) |
| `manage-user` | User management operations |

## Storage

- Bucket `event-attachments` (public) — for event file uploads

## Files You Must NOT Edit

- `src/integrations/supabase/client.ts` — auto-generated
- `src/integrations/supabase/types.ts` — auto-generated
- `supabase/config.toml` — auto-managed
- `.env` — auto-managed

## Known Gaps / TODO

- No email notification when a user is invited (password is random, no reset flow triggered)
- `readonly` role has no specific UI restrictions yet (navigation/actions not filtered by app_role)
- No audit log for admin actions
- The `operators.unit` column is text (not FK to units.id) — legacy design
- Operators don't have login accounts yet (planned for v2/v3 for self-service ranking view)
