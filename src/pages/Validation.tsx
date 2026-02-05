import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Filter,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Validation() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Récupérer les événements en attente
  const { data: events, isLoading } = useQuery({
    queryKey: ['pending-events', categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select(`
          *,
          operator:operators(matricule, full_name, unit),
          event_type:event_types(code, label, category, points),
          creator:profiles!events_created_by_fkey(full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Mutation pour approuver
  const approveMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({
          status: 'approved',
          validated_by: profile?.id,
        })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Événement approuvé');
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Mutation pour rejeter
  const rejectMutation = useMutation({
    mutationFn: async ({ eventId, note }: { eventId: string; note: string }) => {
      const { error } = await supabase
        .from('events')
        .update({
          status: 'rejected',
          validated_by: profile?.id,
          rejection_note: note,
        })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Événement rejeté');
      setShowRejectDialog(false);
      setRejectionNote('');
      setSelectedEvent(null);
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const filteredEvents = events?.filter((event) => {
    const matchesSearch =
      event.operator?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      event.operator?.matricule?.toLowerCase().includes(search.toLowerCase()) ||
      event.event_type?.label?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || event.event_type?.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handleReject = (event: any) => {
    setSelectedEvent(event);
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (!selectedEvent) return;
    rejectMutation.mutate({
      eventId: selectedEvent.id,
      note: rejectionNote,
    });
  };

  const categoryLabels: Record<string, string> = {
    gmp: 'GMP',
    hse: 'HSE',
    comportement: 'Comportement',
    flexibilite: 'Flexibilité',
    assiduite: 'Assiduité',
    bonus: 'Bonus',
    polyvalence: 'Polyvalence',
    productivite: 'Productivité',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">File de validation</h1>
        <p className="text-muted-foreground mt-1">
          Approuvez ou rejetez les événements en attente
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par opérateur ou type..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEvents && filteredEvents.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Opérateur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {format(new Date(event.event_date), 'dd/MM/yyyy', {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {event.operator?.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({event.operator?.matricule})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span>{event.event_type?.label}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {categoryLabels[event.event_type?.category] ||
                              event.event_type?.category}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            (event.event_type?.points || 0) >= 0
                              ? 'text-success'
                              : 'text-destructive'
                          }`}
                        >
                          {(event.event_type?.points || 0) >= 0 ? '+' : ''}
                          {event.event_type?.points} pts
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.creator?.full_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success hover:text-success"
                            onClick={() => approveMutation.mutate(event.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleReject(event)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun événement en attente</p>
              <p className="text-sm">Tous les événements ont été traités</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de rejet */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter l'événement</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du rejet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection_note">Note de justification</Label>
            <Textarea
              id="rejection_note"
              placeholder="Raison du rejet..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
