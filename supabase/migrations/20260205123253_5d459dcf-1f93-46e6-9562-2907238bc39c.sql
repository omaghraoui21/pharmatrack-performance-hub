-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('supervisor', 'manager');

-- Create enum for event status
CREATE TYPE event_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for event categories
CREATE TYPE event_category AS ENUM ('gmp', 'hse', 'comportement', 'flexibilite', 'assiduite', 'bonus', 'polyvalence', 'productivite');

-- Create profiles table for authenticated users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'supervisor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create positions table (postes maîtrisés)
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create operator_positions junction table
CREATE TABLE public.operator_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operator_id, position_id)
);

-- Create event_types table (scoring grid)
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category event_category NOT NULL,
  points DECIMAL(4,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_description BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_date DATE NOT NULL,
  event_time TIME,
  shift TEXT,
  line TEXT,
  description TEXT,
  status event_status NOT NULL DEFAULT 'pending',
  rejection_note TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_operators_updated_at
BEFORE UPDATE ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_types_updated_at
BEFORE UPDATE ON public.event_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'supervisor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- RLS Policies for operators (all authenticated users can view)
CREATE POLICY "Authenticated users can view operators"
ON public.operators FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can insert operators"
ON public.operators FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

CREATE POLICY "Managers can update operators"
ON public.operators FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- RLS Policies for positions
CREATE POLICY "Authenticated users can view positions"
ON public.positions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage positions"
ON public.positions FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- RLS Policies for operator_positions
CREATE POLICY "Authenticated users can view operator positions"
ON public.operator_positions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage operator positions"
ON public.operator_positions FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- RLS Policies for event_types
CREATE POLICY "Authenticated users can view event types"
ON public.event_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage event types"
ON public.event_types FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- RLS Policies for events
CREATE POLICY "Authenticated users can view all events"
ON public.events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Managers can update events"
ON public.events FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Insert default event types
INSERT INTO public.event_types (code, label, category, points, requires_description) VALUES
-- Malus
('RATURE_DOC', 'Rature/document mal rempli', 'gmp', -0.5, false),
('INCIDENT_GMP_MINEUR', 'Incident GMP mineur', 'gmp', -2, false),
('DEVIATION_MINEURE', 'Déviation mineure', 'gmp', -3, true),
('DEVIATION_MAJEURE', 'Déviation majeure', 'gmp', -8, true),
('HSE_DANGER', 'HSE/comportement dangereux', 'hse', -6, true),
('REFUS_FLEX', 'Refus flexibilité', 'flexibilite', -2, false),
('RETARD_POINTAGE', 'Retard de pointage', 'assiduite', -0.5, false),
('PROD_INSUFFISANTE', 'Productivité insuffisante', 'productivite', -1, false),
-- Bonus
('FLEX_2EME_SHIFT', 'Flexibilité (2ème shift)', 'flexibilite', 1, false),
('SIGNALEMENT_PROACTIF', 'Signalement proactif', 'bonus', 0.5, false),
('WEEKEND_TRAVAILLE', 'Weekend travaillé', 'bonus', 1, false),
('HEURES_SUP', 'Heures supplémentaires', 'bonus', 0.5, false),
('BONNE_PROD', 'Bonne productivité', 'productivite', 1, false),
('POLYVALENCE_POSTE', 'Polyvalence (par poste au-delà de 2)', 'polyvalence', 0.5, false);