-- Index pour améliorer les performances du classement
CREATE INDEX IF NOT EXISTS idx_events_operator_id ON public.events(operator_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON public.events(event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_approved_year ON public.events(operator_id, event_date) WHERE status = 'approved';

-- RPC pour calculer le classement annuel côté serveur
CREATE OR REPLACE FUNCTION public.get_year_ranking(p_year integer)
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
SECURITY INVOKER
SET search_path = public
AS $$
  WITH operator_events AS (
    SELECT 
      e.operator_id,
      SUM(et.points) as event_points,
      COUNT(*) as event_count,
      COUNT(DISTINCT e.event_date) as distinct_days
    FROM events e
    JOIN event_types et ON e.event_type_id = et.id
    WHERE e.status = 'approved'
      AND EXTRACT(YEAR FROM e.event_date) = p_year
    GROUP BY e.operator_id
  ),
  operator_positions AS (
    SELECT 
      op.operator_id,
      COUNT(*) as pos_count
    FROM operator_positions op
    GROUP BY op.operator_id
  )
  SELECT 
    o.id as operator_id,
    o.matricule,
    o.full_name,
    o.unit,
    COALESCE(oe.event_points, 0) + GREATEST(0, COALESCE(opos.pos_count, 0) - 2) * 0.5 as raw_points,
    LEAST(100, GREATEST(0, 80 + COALESCE(oe.event_points, 0) + GREATEST(0, COALESCE(opos.pos_count, 0) - 2) * 0.5)) as score100,
    ROUND(LEAST(100, GREATEST(0, 80 + COALESCE(oe.event_points, 0) + GREATEST(0, COALESCE(opos.pos_count, 0) - 2) * 0.5)) / 5, 1) as note20,
    COALESCE(opos.pos_count, 0) as positions_count,
    COALESCE(oe.event_count, 0) as approved_events,
    COALESCE(oe.distinct_days, 0) as work_days
  FROM operators o
  LEFT JOIN operator_events oe ON o.id = oe.operator_id
  LEFT JOIN operator_positions opos ON o.id = opos.operator_id
  WHERE o.is_active = true
  ORDER BY score100 DESC, raw_points DESC;
$$;