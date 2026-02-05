-- =============================================
-- PHASE 1: Scoring - Audit field on events
-- =============================================

-- Add approved_at column for audit trail
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- =============================================
-- PHASE 2: Referentiels (Units, Lines, Shifts)
-- =============================================

-- Table des unites
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des lignes de production
CREATE TABLE IF NOT EXISTS public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, code)
);

-- Table des shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add referential columns to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id),
ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.lines(id),
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id);

-- Insert default units
INSERT INTO public.units (name) VALUES 
  ('DPI'), ('Sterile'), ('Fabrication'), 
  ('Conditionnement'), ('Qualite')
ON CONFLICT (name) DO NOTHING;

-- Insert default shifts
INSERT INTO public.shifts (code, name) VALUES 
  ('A', 'Equipe A'), ('B', 'Equipe B'), ('C', 'Equipe C')
ON CONFLICT (code) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for units (read for all authenticated, write for managers)
CREATE POLICY "Authenticated users can view units" ON public.units
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage units" ON public.units
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- RLS Policies for lines
CREATE POLICY "Authenticated users can view lines" ON public.lines
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage lines" ON public.lines
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- RLS Policies for shifts
CREATE POLICY "Authenticated users can view shifts" ON public.shifts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage shifts" ON public.shifts
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- =============================================
-- PHASE 3: Roles et Profils Enrichis
-- =============================================

-- Create new role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'super_admin', 
    'admin_site', 
    'manager_unite', 
    'superviseur', 
    'readonly'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table (secure role storage)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Add new columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id),
ADD COLUMN IF NOT EXISTS manager_profile_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

-- Function to check if user is at least manager level
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('super_admin', 'admin_site', 'manager_unite')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'manager'
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Migrate existing roles to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 
  CASE 
    WHEN role = 'manager' THEN 'manager_unite'::public.app_role
    ELSE 'superviseur'::public.app_role
  END
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = profiles.id
);

-- =============================================
-- PHASE 4: Cascade Hierarchique
-- =============================================

-- Supervisor to operator mapping table
CREATE TABLE IF NOT EXISTS public.supervisor_operator_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supervisor_id, operator_id, start_date)
);

-- Enable RLS
ALTER TABLE public.supervisor_operator_map ENABLE ROW LEVEL SECURITY;

-- RLS policies for supervisor_operator_map
CREATE POLICY "Authenticated users can view mappings" ON public.supervisor_operator_map
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage mappings" ON public.supervisor_operator_map
FOR ALL TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

-- =============================================
-- PHASE 5: Module Objectifs
-- =============================================

-- Objectives table for supervisor/manager evaluation
CREATE TABLE IF NOT EXISTS public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  target_type TEXT CHECK (target_type IN ('count', 'percentage', 'ratio')),
  target_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  score_0_100 DECIMAL(5,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- RLS policies for objectives
CREATE POLICY "Users can view their own objectives" ON public.objectives
FOR SELECT TO authenticated
USING (owner_profile_id = auth.uid() OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "Users can manage their own objectives" ON public.objectives
FOR INSERT TO authenticated
WITH CHECK (owner_profile_id = auth.uid());

CREATE POLICY "Users can update their own draft objectives" ON public.objectives
FOR UPDATE TO authenticated
USING (owner_profile_id = auth.uid() OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete objectives" ON public.objectives
FOR DELETE TO authenticated
USING (public.is_manager_or_above(auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_objectives_updated_at
BEFORE UPDATE ON public.objectives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PHASE 6: RPC et Performance
-- =============================================

-- Update get_year_ranking with bonus cap and unit filter
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
    -- Cap bonus at 1.5 per day per operator
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
  LEFT JOIN operator_pos op ON o.id = op.operator_id
  WHERE o.is_active = true
    AND (p_unit_id IS NULL OR o.unit = (SELECT name FROM units WHERE id = p_unit_id))
  ORDER BY score100 DESC, raw_points DESC;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_events_unit_id ON public.events(unit_id);
CREATE INDEX IF NOT EXISTS idx_events_composite ON public.events(operator_id, status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_approved_at ON public.events(approved_at);
CREATE INDEX IF NOT EXISTS idx_supervisor_operator_map_supervisor ON public.supervisor_operator_map(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_operator_map_operator ON public.supervisor_operator_map(operator_id);
CREATE INDEX IF NOT EXISTS idx_objectives_owner ON public.objectives(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_objectives_period ON public.objectives(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_unit ON public.profiles(unit_id);