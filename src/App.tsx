import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Operators from "@/pages/Operators";
import NewEvent from "@/pages/NewEvent";
import Validation from "@/pages/Validation";
import Import from "@/pages/Import";
import Scoring from "@/pages/Scoring";
import Ranking from "@/pages/Ranking";
import Settings from "@/pages/Settings";
import Objectives from "@/pages/Objectives";
import HierarchyRanking from "@/pages/HierarchyRanking";
import NotFound from "@/pages/NotFound";

const MANAGER_ROLES = ['manager_unite', 'admin_site', 'super_admin'] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout><Dashboard /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operators"
              element={
                <ProtectedRoute>
                  <AppLayout><Operators /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/new"
              element={
                <ProtectedRoute requiredRoles={['superviseur', ...MANAGER_ROLES]}>
                  <AppLayout><NewEvent /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/validation"
              element={
                <ProtectedRoute requiredRoles={[...MANAGER_ROLES]}>
                  <AppLayout><Validation /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute requiredRoles={[...MANAGER_ROLES]}>
                  <AppLayout><Import /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scoring"
              element={
                <ProtectedRoute requiredRoles={[...MANAGER_ROLES]}>
                  <AppLayout><Scoring /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ranking"
              element={
                <ProtectedRoute>
                  <AppLayout><Ranking /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout><Settings /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/objectives"
              element={
                <ProtectedRoute>
                  <AppLayout><Objectives /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hierarchy-ranking"
              element={
                <ProtectedRoute requiredRoles={[...MANAGER_ROLES]}>
                  <AppLayout><HierarchyRanking /></AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
