import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function Dashboard() {
  const { profile, hasRole, appRoles } = useAuth();

  const isReadonly = appRoles.length === 1 && appRoles[0] === 'readonly';
  const canManage = hasRole('manager_unite') || hasRole('admin_site') || hasRole('super_admin');

  // Récupérer les statistiques
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [pendingRes, approvedRes, rejectedRes, operatorsRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('operators').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      const firstError = pendingRes.error || approvedRes.error || rejectedRes.error || operatorsRes.error;
      if (firstError) throw new Error(firstError.message);

      return {
        pending: pendingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        rejected: rejectedRes.count ?? 0,
        operators: operatorsRes.count ?? 0,
      };
    },
    retry: 1,
  });

  // Récupérer les derniers événements
  const { data: recentEvents, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['recent-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          event_date,
          status,
          operator:operators(full_name),
          event_type:event_types(label, points)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 1,
  });

  const isLoading = statsLoading || eventsLoading;
  const hasError = statsError || eventsError;

  const statCards = [
    {
      title: 'Événements en attente',
      value: stats?.pending || 0,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      description: 'À valider',
    },
    {
      title: 'Événements approuvés',
      value: stats?.approved || 0,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: 'Total',
    },
    {
      title: 'Événements rejetés',
      value: stats?.rejected || 0,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'Total',
    },
    {
      title: 'Opérateurs actifs',
      value: stats?.operators || 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Total',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="pharma-badge-pending">En attente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="pharma-badge-approved">Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="pharma-badge-rejected">Rejeté</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRetry = () => {
    refetchStats();
    refetchEvents();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Bonjour, {profile?.full_name?.split(' ')[0] || 'Utilisateur'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de l'activité PharmaTrack aujourd'hui.
        </p>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Impossible de charger les données du tableau de bord</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title} className="pharma-stat-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Derniers événements
                </CardTitle>
                <CardDescription>Les 5 événements les plus récents</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEvents && recentEvents.length > 0 ? (
                  <div className="space-y-4">
                    {recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {(event.operator as any)?.full_name || 'Opérateur inconnu'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(event.event_type as any)?.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold ${
                            ((event.event_type as any)?.points || 0) >= 0 
                              ? 'text-success' 
                              : 'text-destructive'
                          }`}>
                            {((event.event_type as any)?.points || 0) >= 0 ? '+' : ''}
                            {(event.event_type as any)?.points} pts
                          </span>
                          {getStatusBadge(event.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mb-3 opacity-50" />
                    <p>Aucun événement récent</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                  Actions rapides
                </CardTitle>
                <CardDescription>Accédez rapidement aux fonctionnalités</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {!isReadonly && (
                    <Link
                      to="/events/new"
                      className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Saisir un événement</p>
                        <p className="text-sm text-muted-foreground">
                          Enregistrer un nouvel événement opérateur
                        </p>
                      </div>
                    </Link>
                  )}

                  {canManage && (
                    <Link
                      to="/validation"
                      className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-warning/10">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium">Valider les événements</p>
                        <p className="text-sm text-muted-foreground">
                          {stats?.pending || 0} événements en attente
                        </p>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/ranking"
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <Calendar className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">Voir le classement</p>
                      <p className="text-sm text-muted-foreground">
                        Classement annuel des opérateurs
                      </p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
