
# Plan: Durcissement Scoring + Classement Hierarchique

## Resume de l'analyse

### Etat actuel verifie

**Formules dans la RPC `get_year_ranking` (CONFORMES):**
- `raw_points = event_points + bonus_polyvalence`
- `bonus_polyvalence = max(0, positions_count - 2) * 0.5`
- `score100 = clamp(80 + raw_points, 0, 100)`
- `note20 = round(score100 / 5, 1)`

**Regles anti-gaming implementees:**
- Cap bonus/jour = 1.5 (via CTE `daily_bonus` avec `LEAST(SUM(...), 1.5)`)
- Malus illimites (via `SUM(LEAST(et.points, 0))`)
- Seuls les events `status = 'approved'` comptent

**Points a corriger:**
1. **Tri ranking incomplet**: actuellement `ORDER BY score100 DESC, raw_points DESC` - manque `matricule ASC` comme tiebreaker
2. **Filtre unite**: fonctionne mais pas passe au RPC (filtre cote frontend)
3. **Pas de classement superviseurs/managers**

**Indexes existants (OK):**
- `idx_events_status`, `idx_events_event_date`, `idx_events_operator_id`, `idx_events_event_type_id`, `idx_events_unit_id`, `idx_events_composite`

---

## Phase 1: Correction RPC Operateurs

### 1.1 Ajout tiebreaker matricule

Modifier le tri final de `get_year_ranking`:
```sql
ORDER BY score100 DESC, raw_points DESC, o.matricule ASC
```

### 1.2 Colonne rank calculee

Ajouter une colonne `rank BIGINT` calculee via `ROW_NUMBER()` pour que le frontend n'ait pas a recalculer le rang.

---

## Phase 2: RPC Classement Superviseurs

### 2.1 Nouvelle fonction `get_supervisor_ranking`

Logique:
1. Pour chaque superviseur (via `supervisor_operator_map` actif)
2. Agreger les scores des operateurs assignes
3. Calculer penalites:
   - Events en attente > 5 : -2 points
   - Delai validation moyen > 48h : -3 points
4. Calculer deviations majeures de l'equipe

**Schema retour:**
```sql
RETURNS TABLE (
  supervisor_id UUID,
  supervisor_name TEXT,
  unit_name TEXT,
  operators_count BIGINT,
  avg_team_score NUMERIC,
  pending_events BIGINT,
  avg_validation_delay_hours NUMERIC,
  major_deviations BIGINT,
  supervisor_score NUMERIC,
  rank BIGINT
)
```

**Formule score superviseur:**
```
supervisor_score = avg_team_score 
  - (IF pending_events > 5 THEN 2 ELSE 0)
  - (IF avg_validation_delay > 48 THEN 3 ELSE 0)
```

---

## Phase 3: RPC Classement Managers

### 3.1 Nouvelle fonction `get_manager_ranking`

Logique:
1. Pour chaque manager (role = 'manager' dans profiles)
2. Agreger les scores de tous les operateurs de son unite
3. Calculer metriques:
   - Score moyen equipe (60%)
   - Taux deviations majeures (20%)
   - Delai validation moyen (20%)

**Schema retour:**
```sql
RETURNS TABLE (
  manager_id UUID,
  manager_name TEXT,
  unit_name TEXT,
  operators_count BIGINT,
  avg_unit_score NUMERIC,
  major_deviation_rate NUMERIC,
  avg_validation_delay_hours NUMERIC,
  manager_score NUMERIC,
  rank BIGINT
)
```

**Formule score manager:**
```
manager_score = 
  (avg_unit_score * 0.6)
  + ((100 - major_deviation_rate * 10) * 0.2)
  + ((100 - LEAST(avg_validation_delay / 48 * 100, 100)) * 0.2)
```

---

## Phase 4: Nouvelle Page "Classement Hierarchique"

### 4.1 Structure

Creer `src/pages/HierarchyRanking.tsx` avec:
- Tabs: "Superviseurs" | "Managers"
- Filtres: Annee, Unite (pour superviseurs)
- Tableau avec colonnes specifiques a chaque role
- Export CSV

### 4.2 Navigation

Ajouter dans `AppSidebar.tsx`:
```javascript
{
  title: 'Classement hiérarchique',
  url: '/hierarchy-ranking',
  icon: Users2,
  roles: ['manager'],
}
```

---

## Phase 5: Tests Supplementaires

### 5.1 Tests a ajouter dans `scoring.test.ts`

| Test | Description |
|------|-------------|
| Tri stable | Verifier que le tri score100 > raw_points > matricule est respecte |
| Filtre unite | Verifier que seuls les operateurs de l'unite selectionnee apparaissent |
| Aucun event | Operateur sans event doit avoir score 80 |
| Seulement malus | Pas de cap sur les malus |
| Seulement bonus | Cap a 1.5/jour |

### 5.2 Nouveaux tests RPC

| Test | Description |
|------|-------------|
| Supervisor sans operateurs | Score = 0 ou absent |
| Manager sans unite | Gerer gracieusement |
| Penalite validation 48h | Verifier application |

---

## Resume des livrables

### Migrations SQL

| Fichier | Contenu |
|---------|---------|
| `update_operator_ranking.sql` | Correction tri + ajout colonne rank |
| `create_supervisor_ranking_rpc.sql` | RPC `get_supervisor_ranking` |
| `create_manager_ranking_rpc.sql` | RPC `get_manager_ranking` |

### Fichiers React

| Fichier | Action |
|---------|--------|
| `src/pages/HierarchyRanking.tsx` | Creer |
| `src/components/layout/AppSidebar.tsx` | Ajouter lien navigation |
| `src/App.tsx` | Ajouter route `/hierarchy-ranking` |
| `src/test/scoring.test.ts` | Ajouter tests tri et filtres |

---

## Details techniques

### SQL: RPC get_supervisor_ranking

```sql
CREATE OR REPLACE FUNCTION public.get_supervisor_ranking(
  p_year integer,
  p_unit_id uuid DEFAULT NULL
)
RETURNS TABLE (
  supervisor_id uuid,
  supervisor_name text,
  unit_name text,
  operators_count bigint,
  avg_team_score numeric,
  pending_events bigint,
  avg_validation_delay_hours numeric,
  major_deviations bigint,
  supervisor_score numeric,
  rank bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH supervisor_operators AS (
    SELECT 
      som.supervisor_id,
      p.full_name as supervisor_name,
      u.name as unit_name,
      som.operator_id
    FROM supervisor_operator_map som
    JOIN profiles p ON p.id = som.supervisor_id
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE som.start_date <= CURRENT_DATE
      AND (som.end_date IS NULL OR som.end_date >= CURRENT_DATE)
      AND (p_unit_id IS NULL OR p.unit_id = p_unit_id)
  ),
  operator_scores AS (
    SELECT 
      so.supervisor_id,
      so.supervisor_name,
      so.unit_name,
      COUNT(DISTINCT so.operator_id) as op_count,
      AVG(r.score100) as avg_score
    FROM supervisor_operators so
    LEFT JOIN LATERAL (
      SELECT * FROM get_year_ranking(p_year) 
      WHERE operator_id = so.operator_id
    ) r ON true
    GROUP BY so.supervisor_id, so.supervisor_name, so.unit_name
  ),
  pending_counts AS (
    SELECT 
      so.supervisor_id,
      COUNT(*) as pending_count
    FROM supervisor_operators so
    JOIN events e ON e.operator_id = so.operator_id
    WHERE e.status = 'pending'
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY so.supervisor_id
  ),
  validation_delays AS (
    SELECT 
      so.supervisor_id,
      AVG(EXTRACT(EPOCH FROM (e.approved_at - e.created_at)) / 3600) as avg_delay
    FROM supervisor_operators so
    JOIN events e ON e.operator_id = so.operator_id
    WHERE e.status = 'approved'
      AND e.approved_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY so.supervisor_id
  ),
  major_devs AS (
    SELECT 
      so.supervisor_id,
      COUNT(*) as dev_count
    FROM supervisor_operators so
    JOIN events e ON e.operator_id = so.operator_id
    JOIN event_types et ON et.id = e.event_type_id
    WHERE e.status = 'approved'
      AND et.code = 'DEVIATION_MAJEURE'
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY so.supervisor_id
  ),
  scores AS (
    SELECT 
      os.supervisor_id,
      os.supervisor_name,
      os.unit_name,
      os.op_count,
      COALESCE(os.avg_score, 80) as avg_score,
      COALESCE(pc.pending_count, 0) as pending,
      COALESCE(vd.avg_delay, 0) as avg_delay,
      COALESCE(md.dev_count, 0) as major_devs,
      GREATEST(0, COALESCE(os.avg_score, 80)
        - (CASE WHEN COALESCE(pc.pending_count, 0) > 5 THEN 2 ELSE 0 END)
        - (CASE WHEN COALESCE(vd.avg_delay, 0) > 48 THEN 3 ELSE 0 END)
      ) as final_score
    FROM operator_scores os
    LEFT JOIN pending_counts pc ON pc.supervisor_id = os.supervisor_id
    LEFT JOIN validation_delays vd ON vd.supervisor_id = os.supervisor_id
    LEFT JOIN major_devs md ON md.supervisor_id = os.supervisor_id
  )
  SELECT 
    s.supervisor_id,
    s.supervisor_name,
    s.unit_name,
    s.op_count,
    ROUND(s.avg_score, 1),
    s.pending,
    ROUND(s.avg_delay, 1),
    s.major_devs,
    ROUND(s.final_score, 1),
    ROW_NUMBER() OVER (ORDER BY s.final_score DESC, s.supervisor_name ASC)
  FROM scores s
  ORDER BY final_score DESC, supervisor_name ASC;
$$;
```

### SQL: RPC get_manager_ranking

```sql
CREATE OR REPLACE FUNCTION public.get_manager_ranking(p_year integer)
RETURNS TABLE (
  manager_id uuid,
  manager_name text,
  unit_name text,
  operators_count bigint,
  avg_unit_score numeric,
  major_deviation_rate numeric,
  avg_validation_delay_hours numeric,
  manager_score numeric,
  rank bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH managers AS (
    SELECT 
      p.id,
      p.full_name,
      u.name as unit_name,
      p.unit_id
    FROM profiles p
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE p.role = 'manager' AND p.is_active = true
  ),
  unit_scores AS (
    SELECT 
      m.id as manager_id,
      m.full_name,
      m.unit_name,
      COUNT(DISTINCT o.id) as op_count,
      AVG(r.score100) as avg_score
    FROM managers m
    LEFT JOIN operators o ON o.unit = m.unit_name AND o.is_active = true
    LEFT JOIN LATERAL (
      SELECT * FROM get_year_ranking(p_year) 
      WHERE operator_id = o.id
    ) r ON true
    GROUP BY m.id, m.full_name, m.unit_name
  ),
  unit_deviations AS (
    SELECT 
      m.id as manager_id,
      COUNT(*) FILTER (WHERE et.code = 'DEVIATION_MAJEURE') as major_count,
      COUNT(*) as total_events
    FROM managers m
    JOIN operators o ON o.unit = m.unit_name
    JOIN events e ON e.operator_id = o.id
    JOIN event_types et ON et.id = e.event_type_id
    WHERE e.status = 'approved'
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY m.id
  ),
  validation_delays AS (
    SELECT 
      m.id as manager_id,
      AVG(EXTRACT(EPOCH FROM (e.approved_at - e.created_at)) / 3600) as avg_delay
    FROM managers m
    JOIN operators o ON o.unit = m.unit_name
    JOIN events e ON e.operator_id = o.id
    WHERE e.status = 'approved'
      AND e.approved_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY m.id
  ),
  scores AS (
    SELECT 
      us.manager_id,
      us.full_name,
      us.unit_name,
      us.op_count,
      COALESCE(us.avg_score, 80) as avg_score,
      CASE 
        WHEN COALESCE(ud.total_events, 0) = 0 THEN 0
        ELSE (COALESCE(ud.major_count, 0)::numeric / ud.total_events * 100)
      END as dev_rate,
      COALESCE(vd.avg_delay, 0) as avg_delay,
      -- Score: 60% team + 20% discipline + 20% delay
      (COALESCE(us.avg_score, 80) * 0.6)
      + (GREATEST(0, 100 - COALESCE(ud.major_count, 0)::numeric / NULLIF(ud.total_events, 0) * 1000) * 0.2)
      + (GREATEST(0, 100 - LEAST(COALESCE(vd.avg_delay, 0) / 48 * 100, 100)) * 0.2) as final_score
    FROM unit_scores us
    LEFT JOIN unit_deviations ud ON ud.manager_id = us.manager_id
    LEFT JOIN validation_delays vd ON vd.manager_id = us.manager_id
  )
  SELECT 
    s.manager_id,
    s.full_name,
    s.unit_name,
    s.op_count,
    ROUND(s.avg_score, 1),
    ROUND(s.dev_rate, 2),
    ROUND(s.avg_delay, 1),
    ROUND(s.final_score, 1),
    ROW_NUMBER() OVER (ORDER BY s.final_score DESC, s.full_name ASC)
  FROM scores s
  ORDER BY final_score DESC, full_name ASC;
$$;
```

---

## Ordre d'execution

1. Migration: Corriger `get_year_ranking` (tri + rank)
2. Migration: Creer `get_supervisor_ranking`
3. Migration: Creer `get_manager_ranking`
4. Frontend: Creer `HierarchyRanking.tsx`
5. Frontend: Mettre a jour navigation
6. Tests: Ajouter tests scoring
