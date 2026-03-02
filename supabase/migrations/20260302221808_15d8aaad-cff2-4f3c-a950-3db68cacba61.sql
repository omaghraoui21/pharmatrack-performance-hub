
-- Function: get all operator IDs visible to a given profile
-- Returns operators assigned to self + all descendants via supervisor_operator_map
CREATE OR REPLACE FUNCTION public.get_visible_operator_ids(_profile_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get operators assigned to self or any descendant
  SELECT DISTINCT som.operator_id
  FROM public.supervisor_operator_map som
  WHERE som.supervisor_id IN (
    -- Self
    SELECT _profile_id
    UNION
    -- All descendants
    SELECT get_descendants(_profile_id)
  )
  AND som.start_date <= CURRENT_DATE
  AND (som.end_date IS NULL OR som.end_date >= CURRENT_DATE);
$$;
