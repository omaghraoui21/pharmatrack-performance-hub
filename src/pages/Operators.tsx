import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Users, Loader2 } from 'lucide-react';

interface Operator {
  id: string;
  matricule: string;
  full_name: string;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export default function Operators() {
  const { hasRole, appRoles } = useAuth();
  const canManage = hasRole('manager_unite') || hasRole('admin_site') || hasRole('super_admin');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    matricule: '',
    full_name: '',
    unit: '',
    is_active: true,
  });

  // Récupérer les opérateurs
  const { data: operators, isLoading } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as Operator[];
    },
  });

  // Mutation pour créer/modifier un opérateur
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('operators')
          .update({
            matricule: data.matricule,
            full_name: data.full_name,
            unit: data.unit,
            is_active: data.is_active,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('operators')
          .insert({
            matricule: data.matricule,
            full_name: data.full_name,
            unit: data.unit,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast.success(editingOperator ? 'Opérateur modifié' : 'Opérateur créé');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const filteredOperators = operators?.filter(
    (op) =>
      op.matricule.toLowerCase().includes(search.toLowerCase()) ||
      op.full_name.toLowerCase().includes(search.toLowerCase()) ||
      op.unit.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (operator?: Operator) => {
    if (operator) {
      setEditingOperator(operator);
      setFormData({
        matricule: operator.matricule,
        full_name: operator.full_name,
        unit: operator.unit,
        is_active: operator.is_active,
      });
    } else {
      setEditingOperator(null);
      setFormData({
        matricule: '',
        full_name: '',
        unit: '',
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOperator(null);
    setFormData({
      matricule: '',
      full_name: '',
      unit: '',
      is_active: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingOperator?.id,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Opérateurs</h1>
          <p className="text-muted-foreground mt-1">
            Gérez la liste des opérateurs de production
          </p>
        </div>

        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un opérateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingOperator ? 'Modifier l\'opérateur' : 'Nouvel opérateur'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingOperator
                      ? 'Modifiez les informations de l\'opérateur'
                      : 'Ajoutez un nouvel opérateur au système'}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="matricule">Matricule</Label>
                    <Input
                      id="matricule"
                      placeholder="OP001"
                      value={formData.matricule}
                      onChange={(e) =>
                        setFormData({ ...formData, matricule: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                      id="full_name"
                      placeholder="Jean Dupont"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="unit">Unité</Label>
                    <Input
                      id="unit"
                      placeholder="Production A"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingOperator ? 'Modifier' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par matricule, nom ou unité..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredOperators && filteredOperators.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Statut</TableHead>
                    {canManage && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperators.map((operator) => (
                    <TableRow key={operator.id}>
                      <TableCell className="font-mono font-medium">
                        {operator.matricule}
                      </TableCell>
                      <TableCell>{operator.full_name}</TableCell>
                      <TableCell>{operator.unit}</TableCell>
                      <TableCell>
                        <Badge
                          variant={operator.is_active ? 'default' : 'secondary'}
                          className={
                            operator.is_active
                              ? 'bg-success/10 text-success border-success/20'
                              : ''
                          }
                        >
                          {operator.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(operator)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun opérateur trouvé</p>
              <p className="text-sm">
                {search
                  ? 'Modifiez votre recherche'
                  : 'Commencez par ajouter un opérateur'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
