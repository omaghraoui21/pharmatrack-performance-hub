-- Drop existing functions first to allow return type change
DROP FUNCTION IF EXISTS public.get_year_ranking(integer);
DROP FUNCTION IF EXISTS public.get_year_ranking(integer, uuid);

-- Phase 1: Fix get_year_ranking with matricule tiebreaker and rank column
CREATE FUNCTION public.get_year_ranking(p_year integer, p_unit_id uuid DEFAULT NULL::uuid)
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
  work_days bigint,
  rank bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH daily_bonus AS (
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
  operator_pos AS (
    SELECT operator_id, COUNT(*) as pos_count
    FROM operator_positions
    GROUP BY operator_id
  ),
  ranked AS (
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
      COALESCE(op.pos_count, 0) as positions_count,
      COALESCE(ot.event_count, 0) as approved_events,
      COALESCE(ot.distinct_days, 0) as work_days
    FROM operators o
    LEFT JOIN operator_totals ot ON o.id = ot.operator_id
    LEFT JOIN operator_pos op ON o.id = op.operator_id
    WHERE o.is_active = true
      AND (p_unit_id IS NULL OR o.unit = (SELECT name FROM units WHERE id = p_unit_id))
  )
  SELECT 
    r.id,
    r.matricule,
    r.full_name,
    r.unit,
    r.raw_points,
    r.score100,
    r.note20,
    r.positions_count,
    r.approved_events,
    r.work_days,
    ROW_NUMBER() OVER (ORDER BY r.score100 DESC, r.raw_points DESC, r.matricule ASC)::bigint as rank
  FROM ranked r
  ORDER BY r.score100 DESC, r.raw_points DESC, r.matricule ASC;
$$;

-- Phase 2: Create get_supervisor_ranking RPC
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

-- Phase 3: Create get_manager_ranking RPC
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