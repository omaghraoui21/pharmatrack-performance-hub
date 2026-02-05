
# Plan d'amelioration PharmaTrack Performance

## Resume du contexte

L'application PharmaTrack Performance est fonctionnelle avec:
- Authentification (supervisor/manager)
- Gestion des operateurs
- Saisie d'evenements manuels
- Import CSV
- Grille de scoring
- Classement annuel via RPC `get_year_ranking`
- Page Settings (profil + postes)

Ce plan couvre les evolutions demandees avec des changements minimaux et cibles.

---

## Phase 1: Scoring - Verification et Patch

### 1.1 Verification des formules actuelles

La RPC `get_year_ranking` actuelle calcule deja:
- `raw_points = SUM(event_points) + (positions_count - 2) * 0.5`
- `score100 = clamp(80 + raw_points, 0, 100)`
- `note20 = round(score100 / 5, 1)`

**Statut**: Formules conformes aux specifications.

### 1.2 Ajout du cap bonus/jour (1.5 max)

Modifier la RPC pour appliquer un plafond de +1.5 points bonus par operateur par date:

```text
Logique:
1. Grouper les events bonus par (operator_id, event_date)
2. Pour chaque groupe: cap = MIN(sum_bonus_jour, 1.5)
3. Les malus restent illimites (pas de cap)
```

### 1.3 Ajout champs audit sur events

La table `events` contient deja:
- `created_by` (present)
- `source` (present - manual/import)
- `validated_by` (present)

**Ajouter**: colonne `approved_at TIMESTAMPTZ` pour tracer la date de validation.

### 1.4 Regle 60 jours travailles

La RPC retourne deja `work_days`. L'UI filtre ou affiche un indicateur pour les operateurs avec `work_days < 60`.

---

## Phase 2: Referentiels (Units, Lines, Shifts)

### 2.1 Nouvelles tables

```sql
-- Table des unites
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des lignes de production
CREATE TABLE public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, code)
);

-- Table des shifts
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Donnees initiales

```sql
INSERT INTO units (name) VALUES 
  ('DPI'), ('Sterile'), ('Fabrication'), 
  ('Conditionnement'), ('Qualite');

INSERT INTO shifts (code, name) VALUES 
  ('A', 'Equipe A'), ('B', 'Equipe B'), ('C', 'Equipe C');
```

### 2.3 Modification table events

```sql
ALTER TABLE events 
  ADD COLUMN unit_id UUID REFERENCES units(id),
  ADD COLUMN line_id UUID REFERENCES lines(id),
  ADD COLUMN shift_id UUID REFERENCES shifts(id);
```

### 2.4 UI Settings

Ajouter onglet "Referentiels" dans Settings (Manager uniquement) pour gerer units/lines/shifts.

---

## Phase 3: Roles et Profils Enrichis

### 3.1 Nouveau enum de roles

Remplacer le type `user_role` actuel par un enum etendu:

```sql
CREATE TYPE app_role AS ENUM (
  'super_admin', 
  'admin_site', 
  'manager_unite', 
  'superviseur', 
  'readonly'
);
```

### 3.2 Table user_roles (securite)

Conformement aux bonnes pratiques, les roles seront stockes dans une table separee:

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
```

### 3.3 Modification table profiles

```sql
ALTER TABLE profiles 
  ADD COLUMN unit_id UUID REFERENCES units(id),
  ADD COLUMN manager_profile_id UUID REFERENCES profiles(id),
  ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Supprimer ancienne colonne role apres migration
```

### 3.4 Fonction Security Definer pour roles

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 3.5 RLS actualises

Utiliser `has_role()` dans toutes les policies:
- `super_admin`: acces total
- `manager_unite`: acces limite a son `unit_id`
- `superviseur`: acces a son unite + ses operateurs assignes
- `readonly`: SELECT uniquement

---

## Phase 4: Cascade Hierarchique

### 4.1 Table supervisor_operator_map

```sql
CREATE TABLE public.supervisor_operator_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supervisor_id, operator_id, start_date)
);
```

### 4.2 UI Manager

Ajouter page ou onglet "Affectations" dans Settings:
- Liste des superviseurs avec leurs operateurs assignes
- Interface pour assigner/retirer des operateurs
- Filtrage par unite

---

## Phase 5: Module Objectifs (Evaluation Superviseurs/Managers)

### 5.1 Table objectives

```sql
CREATE TABLE public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID REFERENCES profiles(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  target_type TEXT, -- 'count', 'percentage', 'ratio'
  target_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  score_0_100 DECIMAL(5,2),
  status TEXT DEFAULT 'draft', -- draft/submitted/approved
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Templates KPI

Definir des objectifs types:
- Discipline retards/100j
- Deviations minor/major par mois
- SLA validation <48h
- CAPA on-time %
- Erreurs documentation/100

### 5.3 UI Objectifs

- Page `/objectives` pour visualiser/creer ses objectifs
- Calcul automatique du score pondere: `SUM(score_0_100 * weight) / SUM(weight)`

---

## Phase 6: RPC et Performance

### 6.1 Mise a jour RPC get_year_ranking

```sql
CREATE OR REPLACE FUNCTION public.get_year_ranking(
  p_year integer,
  p_unit_id uuid DEFAULT NULL
)
RETURNS TABLE (
  operator_id uuid,
  matricule text,
  full_name text,
  unit text,
  raw_points numeric,
  score100 numeric,
  note20 numeric,
  positions_count bigint,
  approved_events bigint,
  work_days bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH daily_bonus AS (
    -- Cap bonus a 1.5 par jour par operateur
    SELECT 
      e.operator_id,
      e.event_date,
      LEAST(SUM(GREATEST(et.points, 0)), 1.5) as capped_bonus,
      SUM(LEAST(et.points, 0)) as malus_sum
    FROM events e
    JOIN event_types et ON e.event_type_id = et.id
    WHERE e.status = 'approved'
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY e.operator_id, e.event_date
  ),
  operator_totals AS (
    SELECT 
      db.operator_id,
      SUM(db.capped_bonus + db.malus_sum) as event_points,
      COUNT(*) as event_count,
      COUNT(DISTINCT db.event_date) as distinct_days
    FROM daily_bonus db
    GROUP BY db.operator_id
  ),
  operator_positions AS (
    SELECT operator_id, COUNT(*) as pos_count
    FROM operator_positions
    GROUP BY operator_id
  )
  SELECT 
    o.id,
    o.matricule,
    o.full_name,
    o.unit,
    COALESCE(ot.event_points, 0) 
      + GREATEST(0, COALESCE(op.pos_count, 0) - 2) * 0.5 as raw_points,
    LEAST(100, GREATEST(0, 80 
      + COALESCE(ot.event_points, 0) 
      + GREATEST(0, COALESCE(op.pos_count, 0) - 2) * 0.5)) as score100,
    ROUND(LEAST(100, GREATEST(0, 80 
      + COALESCE(ot.event_points, 0) 
      + GREATEST(0, COALESCE(op.pos_count, 0) - 2) * 0.5)) / 5, 1) as note20,
    COALESCE(op.pos_count, 0),
    COALESCE(ot.event_count, 0),
    COALESCE(ot.distinct_days, 0)
  FROM operators o
  LEFT JOIN operator_totals ot ON o.id = ot.operator_id
  LEFT JOIN operator_positions op ON o.id = op.operator_id
  WHERE o.is_active = true
    AND (p_unit_id IS NULL OR o.unit_id = p_unit_id)
  ORDER BY score100 DESC, raw_points DESC;
$$;
```

### 6.2 Index supplementaires

```sql
CREATE INDEX IF NOT EXISTS idx_events_unit_id ON events(unit_id);
CREATE INDEX IF NOT EXISTS idx_events_composite 
  ON events(operator_id, status, event_date);
CREATE INDEX IF NOT EXISTS idx_supervisor_operator_map_supervisor 
  ON supervisor_operator_map(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_objectives_owner 
  ON objectives(owner_profile_id);
```

---

## Phase 7: Tests

### 7.1 Tests unitaires

Ajouter dans `src/test/`:
- `scoring.test.ts`: verification formules calcul
- `import.test.ts`: parsing CSV et generation events
- `rls.test.ts`: verification acces selon roles

### 7.2 Cas limites a couvrir

- Operateur avec 0 events
- Cap bonus/jour exactement a 1.5
- Operateur avec 59 vs 60 jours travailles
- Import avec matricule inexistant

---

## Resume des fichiers a modifier

### Migrations SQL

1. `add_approved_at_column.sql` - Colonne audit sur events
2. `create_referential_tables.sql` - Tables units, lines, shifts
3. `create_user_roles_system.sql` - Table user_roles + fonction has_role
4. `create_supervisor_operator_map.sql` - Table affectations
5. `create_objectives_table.sql` - Table objectifs
6. `update_ranking_rpc.sql` - RPC avec cap bonus et filtre unit

### Composants React

| Fichier | Modifications |
|---------|---------------|
| `Settings.tsx` | Onglets Referentiels + Affectations |
| `Ranking.tsx` | Filtre par unite + indicateur <60 jours |
| `NewEvent.tsx` | Selects pour unit/line/shift |
| `Validation.tsx` | Afficher approved_at apres validation |
| `AuthContext.tsx` | Adapter lecture roles depuis user_roles |

### Nouvelles pages

| Page | Route | Description |
|------|-------|-------------|
| `Objectives.tsx` | `/objectives` | Gestion objectifs superviseurs/managers |

---

## Dependances et ordre d'execution

```text
Phase 1 (Scoring)
    |
    v
Phase 2 (Referentiels) --> Phase 3 (Roles)
    |                           |
    v                           v
Phase 4 (Hierarchie) <---------+
    |
    v
Phase 5 (Objectifs)
    |
    v
Phase 6 (Perf) + Phase 7 (Tests)
```

---

## Notes techniques

- Toutes les migrations utilisent `IF NOT EXISTS` pour etre idempotentes
- Les RLS policies utilisent `SECURITY DEFINER` pour eviter la recursion infinie
- Le front ne fait aucun fetch global au boot (charge uniquement route visitee)
- Timeout 8s + try/catch/finally sur tous les appels Supabase critiques

