
-- Allow managers to update any profile (not just their own)
CREATE POLICY "Managers can update profiles"
ON profiles FOR UPDATE TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Allow managers to view all roles (not just super_admin)
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users and managers can view roles"
ON user_roles FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR is_manager_or_above(auth.uid()));

-- Allow managers to manage roles (insert/update/delete), not just super_admin
CREATE POLICY "Managers can manage roles"
ON user_roles FOR INSERT TO authenticated
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update roles"
ON user_roles FOR UPDATE TO authenticated
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete roles"
ON user_roles FOR DELETE TO authenticated
USING (is_manager_or_above(auth.uid()));
