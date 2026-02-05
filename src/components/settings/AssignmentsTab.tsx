import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Plus, Trash2, Loader2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Assignment {
  id: string;
  supervisor_id: string;
  operator_id: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Operator {
  id: string;
  matricule: string;
  full_name: string;
  unit: string;
}

export function AssignmentsTab() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');

  // Fetch supervisors (profiles with supervisor role)
  const { data: supervisors } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'supervisor')
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch operators
  const { data: operators } = useQuery({
    queryKey: ['operators-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, matricule, full_name, unit')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data as Operator[];
    },
  });

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['supervisor-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supervisor_operator_map')
        .select('*')
        .is('end_date', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Create assignment
  const createMutation = useMutation({
    mutationFn: async ({ supervisor_id, operator_id }: { supervisor_id: string; operator_id: string }) => {
      const { error } = await supabase
        .from('supervisor_operator_map')
        .insert({ supervisor_id, operator_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Affectation créée');
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
      resetDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  // End assignment (set end_date)
  const endMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supervisor_operator_map')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Affectation terminée');
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const resetDialog = () => {
    setShowDialog(false);
    setSelectedSupervisor('');
    setSelectedOperator('');
  };

  const getSupervisorName = (id: string) => supervisors?.find(s => s.id === id)?.full_name || '-';
  const getOperatorInfo = (id: string) => {
    const op = operators?.find(o => o.id === id);
    return op ? `${op.matricule} - ${op.full_name}` : '-';
  };
  const getOperatorUnit = (id: string) => operators?.find(o => o.id === id)?.unit || '-';

  // Group assignments by supervisor
  const assignmentsBySupervisor = assignments?.reduce((acc, a) => {
    if (!acc[a.supervisor_id]) acc[a.supervisor_id] = [];
    acc[a.supervisor_id].push(a);
    return acc;
  }, {} as Record<string, Assignment[]>) || {};

  // Get assigned operator IDs
  const assignedOperatorIds = new Set(assignments?.map(a => a.operator_id) || []);

  // Available operators (not already assigned)
  const availableOperators = operators?.filter(o => !assignedOperatorIds.has(o.id)) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Affectations Superviseur → Opérateurs
            </CardTitle>
            <CardDescription>
              Assignez des opérateurs aux superviseurs pour définir les périmètres
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle affectation
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(assignmentsBySupervisor).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(assignmentsBySupervisor).map(([supervisorId, supAssignments]) => (
              <div key={supervisorId} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{getSupervisorName(supervisorId)}</h3>
                  <Badge variant="secondary">{supAssignments.length} opérateur(s)</Badge>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opérateur</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>Depuis</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {getOperatorInfo(assignment.operator_id)}
                          </TableCell>
                          <TableCell>{getOperatorUnit(assignment.operator_id)}</TableCell>
                          <TableCell>
                            {format(new Date(assignment.start_date), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() => endMutation.mutate(assignment.id)}
                              disabled={endMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Retirer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucune affectation définie</p>
            <p className="text-sm">Assignez des opérateurs aux superviseurs</p>
          </div>
        )}
      </CardContent>

      {/* Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle affectation</DialogTitle>
            <DialogDescription>
              Assignez un opérateur à un superviseur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Superviseur *</Label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un superviseur..." />
                </SelectTrigger>
                <SelectContent>
                  {supervisors?.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>{sup.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opérateur *</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un opérateur..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.length > 0 ? (
                    availableOperators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.matricule} - {op.full_name} ({op.unit})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Tous les opérateurs sont déjà assignés
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate({ supervisor_id: selectedSupervisor, operator_id: selectedOperator })}
              disabled={createMutation.isPending || !selectedSupervisor || !selectedOperator}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
