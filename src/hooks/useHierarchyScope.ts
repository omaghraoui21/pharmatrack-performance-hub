import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that returns the set of operator IDs visible to the current user
 * based on the hierarchy cascade.
 * 
 * - Managers+ (manager_unite, admin_site, super_admin) see ALL operators
 * - Others see only operators assigned to themselves or their descendants
 */
export function useHierarchyScope() {
  const { profile, hasRole } = useAuth();

  const isFullAccess = hasRole('manager_unite') || hasRole('admin_site') || hasRole('super_admin');

  const { data: visibleOperatorIds, isLoading } = useQuery({
    queryKey: ['visible-operator-ids', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .rpc('get_visible_operator_ids', { _profile_id: profile.id });

      if (error) {
        console.error('[HierarchyScope] Error:', error);
        return [];
      }

      return (data as unknown as string[]) || [];
    },
    enabled: !!profile?.id && !isFullAccess,
  });

  const visibleSet = new Set(visibleOperatorIds || []);

  return {
    /** Whether the user has full access (sees everything) */
    isFullAccess,
    /** Set of visible operator IDs (empty if full access) */
    visibleOperatorIds: visibleSet,
    /** Check if a specific operator is visible */
    canSeeOperator: (operatorId: string) => isFullAccess || visibleSet.has(operatorId),
    /** Loading state */
    isLoading: !isFullAccess && isLoading,
  };
}
