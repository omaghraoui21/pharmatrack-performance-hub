import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, GitBranch, Clock, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  created_at: string;
}

interface Line {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  created_at: string;
}

interface Shift {
  id: string;
  code: string;
  name: string | null;
  created_at: string;
}

export function ReferentialsTab() {
  const queryClient = useQueryClient();
  
  // Dialog states
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  
  // Form states
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const [unitName, setUnitName] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [lineName, setLineName] = useState('');
  const [lineUnitId, setLineUnitId] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [shiftName, setShiftName] = useState('');

  // Fetch units
  const { data: units, isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Fetch lines
  const { data: lines, isLoading: loadingLines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as Line[];
    },
  });

  // Fetch shifts
  const { data: shifts, isLoading: loadingShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as Shift[];
    },
  });

  // Unit mutations
  const saveUnitMutation = useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) {
        const { error } = await supabase.from('units').update({ name }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('units').insert({ name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingUnit ? 'Unité modifiée' : 'Unité créée');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      resetUnitDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Unité supprimée');
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  // Line mutations
  const saveLineMutation = useMutation({
    mutationFn: async ({ id, code, name, unit_id }: { id?: string; code: string; name: string; unit_id: string }) => {
      if (id) {
        const { error } = await supabase.from('lines').update({ code, name, unit_id }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lines').insert({ code, name, unit_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingLine ? 'Ligne modifiée' : 'Ligne créée');
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      resetLineDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ligne supprimée');
      queryClient.invalidateQueries({ queryKey: ['lines'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  // Shift mutations
  const saveShiftMutation = useMutation({
    mutationFn: async ({ id, code, name }: { id?: string; code: string; name: string }) => {
      if (id) {
        const { error } = await supabase.from('shifts').update({ code, name }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shifts').insert({ code, name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingShift ? 'Équipe modifiée' : 'Équipe créée');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      resetShiftDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Équipe supprimée');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  // Dialog handlers
  const openUnitDialog = (unit?: Unit) => {
    setEditingUnit(unit || null);
    setUnitName(unit?.name || '');
    setShowUnitDialog(true);
  };

  const resetUnitDialog = () => {
    setShowUnitDialog(false);
    setEditingUnit(null);
    setUnitName('');
  };

  const openLineDialog = (line?: Line) => {
    setEditingLine(line || null);
    setLineCode(line?.code || '');
    setLineName(line?.name || '');
    setLineUnitId(line?.unit_id || '');
    setShowLineDialog(true);
  };

  const resetLineDialog = () => {
    setShowLineDialog(false);
    setEditingLine(null);
    setLineCode('');
    setLineName('');
    setLineUnitId('');
  };

  const openShiftDialog = (shift?: Shift) => {
    setEditingShift(shift || null);
    setShiftCode(shift?.code || '');
    setShiftName(shift?.name || '');
    setShowShiftDialog(true);
  };

  const resetShiftDialog = () => {
    setShowShiftDialog(false);
    setEditingShift(null);
    setShiftCode('');
    setShiftName('');
  };

  const getUnitName = (unitId: string) => units?.find(u => u.id === unitId)?.name || '-';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Gestion des référentiels
        </CardTitle>
        <CardDescription>
          Gérez les unités, lignes de production et équipes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="units" className="space-y-4">
          <TabsList>
            <TabsTrigger value="units" className="gap-2">
              <Building2 className="h-4 w-4" />
              Unités
            </TabsTrigger>
            <TabsTrigger value="lines" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Lignes
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-2">
              <Clock className="h-4 w-4" />
              Équipes
            </TabsTrigger>
          </TabsList>

          {/* Units Tab */}
          <TabsContent value="units">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openUnitDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle unité
              </Button>
            </div>
            {loadingUnits ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : units && units.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">{unit.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openUnitDialog(unit)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deleteUnitMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer l'unité</AlertDialogTitle>
                                  <AlertDialogDescription>Cette action est irréversible. Voulez-vous continuer ?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteUnitMutation.mutate(unit.id)}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune unité définie</p>
              </div>
            )}
          </TabsContent>

          {/* Lines Tab */}
          <TabsContent value="lines">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openLineDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle ligne
              </Button>
            </div>
            {loadingLines ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : lines && lines.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono">{line.code}</TableCell>
                        <TableCell className="font-medium">{line.name}</TableCell>
                        <TableCell>{getUnitName(line.unit_id)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openLineDialog(line)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deleteLineMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer la ligne</AlertDialogTitle>
                                  <AlertDialogDescription>Cette action est irréversible. Voulez-vous continuer ?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteLineMutation.mutate(line.id)}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune ligne définie</p>
              </div>
            )}
          </TabsContent>

          {/* Shifts Tab */}
          <TabsContent value="shifts">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openShiftDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle équipe
              </Button>
            </div>
            {loadingShifts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : shifts && shifts.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-mono">{shift.code}</TableCell>
                        <TableCell className="font-medium">{shift.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openShiftDialog(shift)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deleteShiftMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer l'équipe</AlertDialogTitle>
                                  <AlertDialogDescription>Cette action est irréversible. Voulez-vous continuer ?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteShiftMutation.mutate(shift.id)}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune équipe définie</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Unit Dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Modifier l\'unité' : 'Nouvelle unité'}</DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Modifiez le nom de l\'unité' : 'Créez une nouvelle unité de production'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit_name">Nom de l'unité *</Label>
              <Input
                id="unit_name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Ex: DPI, Stérile..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetUnitDialog}>Annuler</Button>
            <Button
              onClick={() => saveUnitMutation.mutate({ id: editingUnit?.id, name: unitName })}
              disabled={saveUnitMutation.isPending || !unitName.trim()}
            >
              {saveUnitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUnit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line Dialog */}
      <Dialog open={showLineDialog} onOpenChange={setShowLineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Modifier la ligne' : 'Nouvelle ligne'}</DialogTitle>
            <DialogDescription>
              {editingLine ? 'Modifiez les informations de la ligne' : 'Créez une nouvelle ligne de production'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="line_unit">Unité *</Label>
              <Select value={lineUnitId} onValueChange={setLineUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une unité..." />
                </SelectTrigger>
                <SelectContent>
                  {units?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line_code">Code *</Label>
              <Input
                id="line_code"
                value={lineCode}
                onChange={(e) => setLineCode(e.target.value)}
                placeholder="Ex: D01, D02..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line_name">Nom *</Label>
              <Input
                id="line_name"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                placeholder="Ex: Ligne de conditionnement 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetLineDialog}>Annuler</Button>
            <Button
              onClick={() => saveLineMutation.mutate({ id: editingLine?.id, code: lineCode, name: lineName, unit_id: lineUnitId })}
              disabled={saveLineMutation.isPending || !lineCode.trim() || !lineName.trim() || !lineUnitId}
            >
              {saveLineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLine ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Modifier l\'équipe' : 'Nouvelle équipe'}</DialogTitle>
            <DialogDescription>
              {editingShift ? 'Modifiez les informations de l\'équipe' : 'Créez une nouvelle équipe (shift)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shift_code">Code *</Label>
              <Input
                id="shift_code"
                value={shiftCode}
                onChange={(e) => setShiftCode(e.target.value)}
                placeholder="Ex: A, B, C..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift_name">Nom</Label>
              <Input
                id="shift_name"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="Ex: Équipe du matin"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetShiftDialog}>Annuler</Button>
            <Button
              onClick={() => saveShiftMutation.mutate({ id: editingShift?.id, code: shiftCode, name: shiftName })}
              disabled={saveShiftMutation.isPending || !shiftCode.trim()}
            >
              {saveShiftMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingShift ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
