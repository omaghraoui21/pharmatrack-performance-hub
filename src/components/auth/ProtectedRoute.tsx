import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

type AppRole = 'super_admin' | 'admin_site' | 'manager_unite' | 'superviseur' | 'readonly';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export const ProtectedRoute = React.forwardRef<HTMLDivElement, ProtectedRouteProps>(
  function ProtectedRoute({ children, requiredRoles }, ref) {
    const { user, loading, appRoles } = useAuth();
    const location = useLocation();

    if (loading) {
      return (
        <div ref={ref} className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = appRoles.some((role) => requiredRoles.includes(role));
      if (!hasRequiredRole) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    return <div ref={ref}>{children}</div>;
  }
);
