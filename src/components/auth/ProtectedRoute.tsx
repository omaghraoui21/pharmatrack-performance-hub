import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

export const ProtectedRoute = React.forwardRef<HTMLDivElement, ProtectedRouteProps>(
  function ProtectedRoute({ children, requireManager = false }, ref) {
    const { user, profile, loading, isManager } = useAuth();
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

    if (requireManager && !isManager) {
      return <Navigate to="/dashboard" replace />;
    }

    return <div ref={ref}>{children}</div>;
  }
);
