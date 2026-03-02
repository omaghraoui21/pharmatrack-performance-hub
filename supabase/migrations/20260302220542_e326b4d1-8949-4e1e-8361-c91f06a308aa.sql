
-- =============================================
-- Migration: Replace legacy profiles.role checks with is_manager_or_above()
-- Tables: event_types, operators, events, positions, units, lines, shifts, operator_positions
-- =============================================

-- 1. event_types
DROP POLICY IF EXISTS "Managers can manage event types" ON public.event_types;
CREATE POLICY "Managers can manage event types"
ON public.event_types
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- 2. operators (INSERT)
DROP POLICY IF EXISTS "Managers can insert operators" ON public.operators;
CREATE POLICY "Managers can insert operators"
ON public.operators
FOR INSERT
TO authenticated
WITH CHECK (is_manager_or_above(auth.uid()));

-- 2. operators (UPDATE)
DROP POLICY IF EXISTS "Managers can update operators" ON public.operators;
CREATE POLICY "Managers can update operators"
ON public.operators
FOR UPDATE
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- 3. events (UPDATE)
DROP POLICY IF EXISTS "Managers can update events" ON public.events;
CREATE POLICY "Managers can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- 4. positions
DROP POLICY IF EXISTS "Managers can manage positions" ON public.positions;
CREATE POLICY "Managers can manage positions"
ON public.positions
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- 5. units
DROP POLICY IF EXISTS "Managers can manage units" ON public.units;
CREATE POLICY "Managers can manage units"
ON public.units
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- 6. lines
DROP POLICY IF EXISTS "Managers can manage lines" ON public.lines;
CREATE POLICY "Managers can manage lines"
ON public.lines
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- 7. shifts
DROP POLICY IF EXISTS "Managers can manage shifts" ON public.shifts;
CREATE POLICY "Managers can manage shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- 8. operator_positions
DROP POLICY IF EXISTS "Managers can manage operator positions" ON public.operator_positions;
CREATE POLICY "Managers can manage operator positions"
ON public.operator_positions
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()));
