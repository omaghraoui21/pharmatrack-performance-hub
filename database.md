# PharmaTrack — Database Documentation

## Overview

PostgreSQL database managed via Lovable Cloud (Supabase). Tracks pharmaceutical operator performance through daily events, hierarchical management, and annual scoring.

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| `user_role` | `supervisor`, `manager` | Legacy role on `profiles.role` |
| `app_role` | `super_admin`, `admin_site`, `manager_unite`, `superviseur`, `readonly` | Granular permissions in `user_roles` |
| `event_category` | `gmp`, `hse`, `comportement`, `flexibilite`, `assiduite`, `bonus`, `polyvalence`, `productivite` | Event classification |
| `event_status` | `pending`, `approved`, `rejected` | Event workflow state |

---

## Tables

### `profiles`
User accounts (1:1 with `auth.users`). Created automatically via `handle_new_user()` trigger.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | — | = `auth.users.id` |
| `email` | text | No | — | |
| `full_name` | text | No | — | |
| `role` | `user_role` | No | `'supervisor'` | Legacy field |
| `unit_id` | uuid FK→`units` | Yes | — | |
| `manager_profile_id` | uuid FK→`profiles` | Yes | — | Legacy, replaced by `hierarchy_links` |
| `is_active` | boolean | Yes | `true` | Inactive = blocked login |
| `created_at` | timestamptz | No | `now()` | |
| `updated_at` | timestamptz | No | `now()` | |

**RLS**: SELECT all; UPDATE own or `is_manager_or_above`; no INSERT/DELETE via client.

---

### `user_roles`
Granular app-level roles (many-to-many: user ↔ role).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `user_id` | uuid | No | — |
| `role` | `app_role` | No | — |
| `created_at` | timestamptz | Yes | `now()` |

**Unique**: `(user_id, role)`  
**RLS**: SELECT own + managers; INSERT/UPDATE/DELETE by `is_manager_or_above`; full ALL by `super_admin`.

---

### `hierarchy_links`
**Dynamic N-level org chart.** Parent-child links between profiles. Supports N:N (one child can have multiple parents for polyvalence). Replaces the old `manager_profile_id` approach.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `parent_id` | uuid FK→`profiles` | No | — |
| `child_id` | uuid FK→`profiles` | No | — |
| `start_date` | date | No | `CURRENT_DATE` |
| `end_date` | date | Yes | — |
| `created_at` | timestamptz | Yes | `now()` |

**RLS**: SELECT all; ALL by `is_manager_or_above`.

**Key concept**: The recursive function `get_descendants(profile_id)` traverses this tree to find all subordinates at any depth. Active links = `start_date <= today AND (end_date IS NULL OR end_date >= today)`.

---

### `operators`
Factory floor workers (no login account). Tracked for performance scoring.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `matricule` | text | No | — | Unique employee ID |
| `full_name` | text | No | — |
| `unit` | text | No | — | ⚠️ Legacy: text, not FK to `units` |
| `is_active` | boolean | No | `true` |
| `created_at` | timestamptz | No | `now()` |
| `updated_at` | timestamptz | No | `now()` |

**RLS**: SELECT all; INSERT/UPDATE by `is_manager_or_above`; no DELETE.

---

### `supervisor_operator_map`
Assigns profiles (supervisors/team leads) to operators. Used by `get_visible_operator_ids()` to determine visibility scope.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `supervisor_id` | uuid FK→`profiles` | No | — |
| `operator_id` | uuid FK→`operators` | No | — |
| `start_date` | date | No | `CURRENT_DATE` |
| `end_date` | date | Yes | — |
| `created_at` | timestamptz | Yes | `now()` |

**RLS**: SELECT all; ALL by `is_manager_or_above`.

---

### `events`
Daily incidents/behaviors recorded for operators.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `operator_id` | uuid FK→`operators` | No | — |
| `event_type_id` | uuid FK→`event_types` | No | — |
| `event_date` | date | No | — |
| `event_time` | time | Yes | — |
| `status` | `event_status` | No | `'pending'` |
| `description` | text | Yes | — |
| `created_by` | uuid FK→`profiles` | No | — |
| `validated_by` | uuid FK→`profiles` | Yes | — |
| `approved_at` | timestamptz | Yes | — |
| `rejection_note` | text | Yes | — |
| `unit_id` | uuid FK→`units` | Yes | — |
| `line_id` | uuid FK→`lines` | Yes | — |
| `shift_id` | uuid FK→`shifts` | Yes | — |
| `shift` | text | Yes | — | Legacy text field |
| `line` | text | Yes | — | Legacy text field |
| `source` | text | Yes | `'manual'` | `manual` or `import` |
| `attachment_url` | text | Yes | — |
| `created_at` | timestamptz | No | `now()` |
| `updated_at` | timestamptz | No | `now()` |

**RLS**: SELECT all; INSERT by `created_by = auth.uid()`; UPDATE by `is_manager_or_above`; no DELETE.

---

### `event_types`
Reference table defining event categories and their point values.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `code` | text | No | — | e.g. `DEVIATION_MAJEURE` |
| `label` | text | No | — |
| `category` | `event_category` | No | — |
| `points` | numeric | No | — | Positive = bonus, negative = malus |
| `is_active` | boolean | No | `true` |
| `requires_description` | boolean | No | `false` |
| `created_at` | timestamptz | No | `now()` |
| `updated_at` | timestamptz | No | `now()` |

**RLS**: SELECT all; ALL by `is_manager_or_above`.

---

### `units`
Organizational units (production departments).

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | — |
| `created_at` | timestamptz | `now()` |

---

### `lines`
Production lines within units.

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `code` | text | — |
| `name` | text | — |
| `unit_id` | uuid FK→`units` | — |
| `created_at` | timestamptz | `now()` |

---

### `shifts`
Work shifts (A, B, C…).

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `code` | text | — |
| `name` | text | — |
| `created_at` | timestamptz | `now()` |

---

### `positions`
Job positions for operator versatility tracking.

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | — |
| `description` | text | — |
| `created_at` | timestamptz | `now()` |

---

### `operator_positions`
Many-to-many: operators ↔ positions (polyvalence).

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `operator_id` | uuid FK→`operators` | — |
| `position_id` | uuid FK→`positions` | — |
| `assigned_at` | timestamptz | `now()` |

---

### `objectives`
Personal objectives with scoring for profile owners.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `owner_profile_id` | uuid FK→`profiles` | No | — |
| `title` | text | No | — |
| `description` | text | Yes | — |
| `period_start` | date | No | — |
| `period_end` | date | No | — |
| `weight` | numeric | Yes | `1.0` |
| `target_type` | text | Yes | — |
| `target_value` | numeric | Yes | — |
| `actual_value` | numeric | Yes | — |
| `score_0_100` | numeric | Yes | — |
| `status` | text | Yes | `'draft'` |
| `manager_comment` | text | Yes | — |
| `created_at` | timestamptz | Yes | `now()` |
| `updated_at` | timestamptz | Yes | `now()` |

**RLS**: SELECT own + managers; INSERT own; UPDATE own + managers; DELETE managers only.

---

## Database Functions

### Security Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `has_role(_user_id, _role)` | boolean | SECURITY DEFINER. Checks `user_roles` table. Used in RLS policies. |
| `is_manager_or_above(_user_id)` | boolean | SECURITY DEFINER. True if user has `super_admin`, `admin_site`, or `manager_unite` role, OR `profiles.role = 'manager'`. |

### Hierarchy Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_descendants(_profile_id)` | SETOF uuid | SECURITY DEFINER. Recursive CTE traversing `hierarchy_links` to get all subordinate profile IDs at any depth. Only considers active links (date-filtered). |
| `get_visible_operator_ids(_profile_id)` | SETOF uuid | SECURITY DEFINER. Returns operator IDs from `supervisor_operator_map` where supervisor is self OR any descendant. Core of the cascading visibility system. |

### Ranking Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_year_ranking(p_year, p_unit_id?)` | table | Computes annual operator scores. Base 80/100 + daily bonus (capped +1.5/day) + malus (uncapped) + polyvalence bonus `(positions-2)×0.5`. |
| `get_supervisor_ranking(p_year, p_unit_id?)` | table | Ranks supervisors by team avg score, pending events penalty, validation delay penalty. |
| `get_manager_ranking(p_year)` | table | Ranks managers: 60% unit avg score + 20% deviation rate + 20% validation speed. |

### Trigger Functions

| Function | Purpose |
|----------|---------|
| `handle_new_user()` | Trigger on `auth.users` INSERT → auto-creates `profiles` row with metadata. |
| `update_updated_at_column()` | Generic trigger to set `updated_at = now()` on UPDATE. |

---

## Hierarchy & Visibility Model

```
Manager (profile)
  └── hierarchy_links → Sub-manager (profile)
       └── hierarchy_links → Supervisor (profile)
            └── hierarchy_links → Team Lead (profile)
                 └── supervisor_operator_map → Operator 1
                 └── supervisor_operator_map → Operator 2
```

**Key rules:**
1. `hierarchy_links` = profile-to-profile (N:N, date-bounded)
2. `supervisor_operator_map` = profile-to-operator (N:N, date-bounded)
3. `get_descendants()` walks the `hierarchy_links` tree recursively
4. `get_visible_operator_ids()` collects operators from self + all descendants
5. Managers+ (`manager_unite`, `admin_site`, `super_admin`) bypass hierarchy = see ALL operators
6. An operator CAN be under multiple leads (polyvalence)

---

## Scoring Formula

```
daily_bonus = MIN(SUM(positive_points), 1.5)  -- per operator per day
daily_malus = SUM(negative_points)             -- uncapped
event_points = SUM(daily_bonus + daily_malus)  -- across all days in year
polyvalence_bonus = MAX(0, positions_count - 2) × 0.5
score100 = CLAMP(0, 100, 80 + event_points + polyvalence_bonus)
note20 = score100 / 5
```

---

## Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `event-attachments` | Yes | File uploads attached to events |

---

## Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `invite-user` | POST | Bearer (manager+) | Creates auth user + profile + roles via `admin.createUser()` |
| `seed-demo-users` | POST | None | Creates 5 demo accounts for testing |
| `manage-user` | — | — | User management operations |
