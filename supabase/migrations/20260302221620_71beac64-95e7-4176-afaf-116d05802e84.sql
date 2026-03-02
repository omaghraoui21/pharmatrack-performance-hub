
-- =============================================
-- Create hierarchy_links table for N-level profile hierarchy
-- =============================================

CREATE TABLE public.hierarchy_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_link CHECK (parent_id != child_id),
  CONSTRAINT unique_active_link UNIQUE (parent_id, child_id)
);

-- Index for fast descendant lookups
CREATE INDEX idx_hierarchy_parent ON public.hierarchy_links(parent_id) WHERE end_date IS NULL;
CREATE INDEX idx_hierarchy_child ON public.hierarchy_links(child_id) WHERE end_date IS NULL;

-- Enable RLS
ALTER TABLE public.hierarchy_links ENABLE ROW LEVEL SECURITY;

-- Everyone can read hierarchy
CREATE POLICY "Authenticated users can view hierarchy"
ON public.hierarchy_links FOR SELECT TO authenticated
USING (true);

-- Managers+ can manage hierarchy
CREATE POLICY "Managers can manage hierarchy"
ON public.hierarchy_links FOR ALL TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- =============================================
-- Recursive function: get all descendant profile IDs
-- =============================================
CREATE OR REPLACE FUNCTION public.get_descendants(_profile_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    -- Direct children
    SELECT child_id AS id
    FROM public.hierarchy_links
    WHERE parent_id = _profile_id
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    UNION
    -- Recursive children
    SELECT hl.child_id
    FROM public.hierarchy_links hl
    JOIN tree t ON hl.parent_id = t.id
    WHERE hl.start_date <= CURRENT_DATE
      AND (hl.end_date IS NULL OR hl.end_date >= CURRENT_DATE)
  )
  SELECT id FROM tree;
$$;

-- =============================================
-- Migrate existing manager_profile_id data into hierarchy_links
-- =============================================
INSERT INTO public.hierarchy_links (parent_id, child_id, start_date)
SELECT manager_profile_id, id, CURRENT_DATE
FROM public.profiles
WHERE manager_profile_id IS NOT NULL
  AND is_active = true
ON CONFLICT (parent_id, child_id) DO NOTHING;

-- Enable realtime for hierarchy_links
ALTER PUBLICATION supabase_realtime ADD TABLE public.hierarchy_links;
