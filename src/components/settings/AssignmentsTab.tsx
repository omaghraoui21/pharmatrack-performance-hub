import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Plus, Trash2, Loader2, UserCheck, Network } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HierarchyLink {
  id: string;
  parent_id: string;
  child_id: string;
  start_date: string;
  end_date: string | null;
}

interface Assignment {
  id: string;
  supervisor_id: string;
  operator_id: string;
  start_date: string;
  end_date: string | null;
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

  // Dialog states
  const [showHierarchyDialog, setShowHierarchyDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [selectedParent, setSelectedParent] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');

  // Fetch all active profiles
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch user roles for badge display
  const { data: userRoles } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data as { user_id: string; role: string }[];
    },
  });

  // Fetch hierarchy links
  const { data: hierarchyLinks, isLoading: loadingHierarchy } = useQuery({
    queryKey: ['hierarchy-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hierarchy_links')
        .select('*')
        .is('end_date', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as HierarchyLink[];
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

  // Fetch operator assignments
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
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

  // Helper: get profile name
  const getProfileName = (id: string) => profiles?.find(p => p.id === id)?.full_name || '—';

  // Helper: get profile role badge
  const getProfileRoleBadge = (id: string) => {
    const roles = userRoles?.filter(r => r.user_id === id).map(r => r.role) || [];
    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin_site: 'Admin',
      manager_unite: 'Manager',
      superviseur: 'Superviseur',
      readonly: 'Lecture seule',
    };
    return roles.map(r => roleLabels[r] || r).join(', ');
  };

  // Helper: get operator info
  const getOperatorInfo = (id: string) => {
    const op = operators?.find(o => o.id === id);
    return op ? `${op.matricule} — ${op.full_name}` : '—';
  };
  const getOperatorUnit = (id: string) => operators?.find(o => o.id === id)?.unit || '—';

  // ======== HIERARCHY mutations ========
  const createHierarchyMutation = useMutation({
    mutationFn: async ({ parent_id, child_id }: { parent_id: string; child_id: string }) => {
      const { error } = await supabase
        .from('hierarchy_links')
        .insert({ parent_id, child_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lien hiérarchique créé');
      queryClient.invalidateQueries({ queryKey: ['hierarchy-links'] });
      resetHierarchyDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const endHierarchyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hierarchy_links')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lien hiérarchique terminé');
      queryClient.invalidateQueries({ queryKey: ['hierarchy-links'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  // ======== ASSIGNMENT mutations ========
  const createAssignmentMutation = useMutation({
    mutationFn: async ({ supervisor_id, operator_id }: { supervisor_id: string; operator_id: string }) => {
      const { error } = await supabase
        .from('supervisor_operator_map')
        .insert({ supervisor_id, operator_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Affectation créée');
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
      resetAssignmentDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const endAssignmentMutation = useMutation({
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

  // Resets
  const resetHierarchyDialog = () => {
    setShowHierarchyDialog(false);
    setSelectedParent('');
    setSelectedChild('');
  };
  const resetAssignmentDialog = () => {
    setShowAssignmentDialog(false);
    setSelectedSupervisor('');
    setSelectedOperator('');
  };

  // Group hierarchy by parent
  const hierarchyByParent = hierarchyLinks?.reduce((acc, l) => {
    if (!acc[l.parent_id]) acc[l.parent_id] = [];
    acc[l.parent_id].push(l);
    return acc;
  }, {} as Record<string, HierarchyLink[]>) || {};

  // Group assignments by supervisor
  const assignmentsBySupervisor = assignments?.reduce((acc, a) => {
    if (!acc[a.supervisor_id]) acc[a.supervisor_id] = [];
    acc[a.supervisor_id].push(a);
    return acc;
  }, {} as Record<string, Assignment[]>) || {};

  // Children already linked
  const linkedChildIds = new Set(hierarchyLinks?.map(l => l.child_id) || []);
  // Available children = all profiles not already child of someone (allow N:N by NOT filtering)
  // Actually user said N:N is allowed, so just exclude self-links
  const getAvailableChildren = (parentId: string) => {
    const existingChildren = new Set(
      hierarchyLinks?.filter(l => l.parent_id === parentId).map(l => l.child_id) || []
    );
    return profiles?.filter(p => p.id !== parentId && !existingChildren.has(p.id)) || [];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Organigramme & Affectations
        </CardTitle>
        <CardDescription>
          Gérez la hiérarchie entre encadrants et l'affectation des opérateurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hierarchy" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hierarchy" className="gap-2">
              <Network className="h-4 w-4" />
              Hiérarchie
            </TabsTrigger>
            <TabsTrigger value="operators" className="gap-2">
              <Users className="h-4 w-4" />
              Opérateurs
            </TabsTrigger>
          </TabsList>

          {/* ============ HIERARCHY TAB ============ */}
          <TabsContent value="hierarchy">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowHierarchyDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau lien
              </Button>
            </div>

            {loadingHierarchy ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Object.keys(hierarchyByParent).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(hierarchyByParent).map(([parentId, children]) => (
                  <div key={parentId} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{getProfileName(parentId)}</h3>
                      <Badge variant="outline" className="text-xs">{getProfileRoleBadge(parentId)}</Badge>
                      <Badge variant="secondary">{children.length} subordonné(s)</Badge>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subordonné</TableHead>
                            <TableHead>Rôle</TableHead>
                            <TableHead>Depuis</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {children.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell className="font-medium">{getProfileName(link.child_id)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{getProfileRoleBadge(link.child_id)}</Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(link.start_date), 'dd/MM/yyyy', { locale: fr })}
                              </TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={endHierarchyMutation.isPending}>
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Retirer
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Retirer le lien hiérarchique</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {getProfileName(link.child_id)} ne sera plus subordonné de {getProfileName(parentId)}. Continuer ?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => endHierarchyMutation.mutate(link.id)}>Retirer</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
                <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucun lien hiérarchique</p>
                <p className="text-sm">Créez des liens parent → subordonné entre les encadrants</p>
              </div>
            )}
          </TabsContent>

          {/* ============ OPERATORS TAB ============ */}
          <TabsContent value="operators">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAssignmentDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle affectation
              </Button>
            </div>

            {loadingAssignments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Object.keys(assignmentsBySupervisor).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(assignmentsBySupervisor).map(([supervisorId, supAssignments]) => (
                  <div key={supervisorId} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{getProfileName(supervisorId)}</h3>
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
                              <TableCell className="font-medium">{getOperatorInfo(assignment.operator_id)}</TableCell>
                              <TableCell>{getOperatorUnit(assignment.operator_id)}</TableCell>
                              <TableCell>{format(new Date(assignment.start_date), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={endAssignmentMutation.isPending}>
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Retirer
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Retirer l'affectation</AlertDialogTitle>
                                      <AlertDialogDescription>Cette action est irréversible. Voulez-vous continuer ?</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => endAssignmentMutation.mutate(assignment.id)}>Retirer</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
                <p className="text-lg font-medium">Aucune affectation</p>
                <p className="text-sm">Assignez des opérateurs aux encadrants</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* ============ HIERARCHY DIALOG ============ */}
      <Dialog open={showHierarchyDialog} onOpenChange={setShowHierarchyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau lien hiérarchique</DialogTitle>
            <DialogDescription>Définissez un lien supérieur → subordonné entre deux encadrants</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supérieur (parent) *</Label>
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le supérieur..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {getProfileRoleBadge(p.id) ? ` (${getProfileRoleBadge(p.id)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subordonné (enfant) *</Label>
              <Select value={selectedChild} onValueChange={setSelectedChild} disabled={!selectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedParent ? 'Sélectionner le subordonné...' : 'Choisir d\'abord le supérieur'} />
                </SelectTrigger>
                <SelectContent>
                  {selectedParent && getAvailableChildren(selectedParent).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {getProfileRoleBadge(p.id) ? ` (${getProfileRoleBadge(p.id)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetHierarchyDialog}>Annuler</Button>
            <Button
              onClick={() => createHierarchyMutation.mutate({ parent_id: selectedParent, child_id: selectedChild })}
              disabled={createHierarchyMutation.isPending || !selectedParent || !selectedChild}
            >
              {createHierarchyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ASSIGNMENT DIALOG ============ */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle affectation opérateur</DialogTitle>
            <DialogDescription>Assignez un opérateur à un encadrant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Encadrant *</Label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un encadrant..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {getProfileRoleBadge(p.id) ? ` (${getProfileRoleBadge(p.id)})` : ''}
                    </SelectItem>
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
                  {operators?.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.matricule} — {op.full_name} ({op.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAssignmentDialog}>Annuler</Button>
            <Button
              onClick={() => createAssignmentMutation.mutate({ supervisor_id: selectedSupervisor, operator_id: selectedOperator })}
              disabled={createAssignmentMutation.isPending || !selectedSupervisor || !selectedOperator}
            >
              {createAssignmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
