import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ListChecks, Pencil, Loader2, Plus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EventCategory = Database['public']['Enums']['event_category'];

interface EventType {
  id: string;
  code: string;
  label: string;
  category: string;
  points: number;
  is_active: boolean;
  requires_description: boolean;
}

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

export default function Scoring() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventType | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    category: 'gmp' as EventCategory,
    points: 0,
    is_active: true,
    requires_description: false,
  });

  // Récupérer les types d'événements
  const { data: eventTypes, isLoading } = useQuery({
    queryKey: ['event-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .order('category')
        .order('label');

      if (error) throw error;
      return data as EventType[];
    },
  });

  // Mutation pour créer/modifier
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('event_types')
          .update({
            code: data.code,
            label: data.label,
            category: data.category,
            points: data.points,
            is_active: data.is_active,
            requires_description: data.requires_description,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_types').insert({
          code: data.code,
          label: data.label,
          category: data.category,
          points: data.points,
          is_active: data.is_active,
          requires_description: data.requires_description,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-types'] });
      toast.success(editingType ? 'Type modifié' : 'Type créé');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const handleOpenDialog = (eventType?: EventType) => {
    if (eventType) {
      setEditingType(eventType);
      setFormData({
        code: eventType.code,
        label: eventType.label,
        category: eventType.category as EventCategory,
        points: eventType.points,
        is_active: eventType.is_active,
        requires_description: eventType.requires_description,
      });
    } else {
      setEditingType(null);
      setFormData({
        code: '',
        label: '',
        category: 'gmp',
        points: 0,
        is_active: true,
        requires_description: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingType?.id,
    });
  };

  // Grouper par catégorie
  const groupedTypes = eventTypes?.reduce((acc, et) => {
    if (!acc[et.category]) {
      acc[et.category] = [];
    }
    acc[et.category].push(et);
    return acc;
  }, {} as Record<string, EventType[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grille de scoring</h1>
          <p className="text-muted-foreground mt-1">
            Configurez les types d'événements et leurs points
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau type
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6">
          {groupedTypes &&
            Object.entries(groupedTypes).map(([category, types]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    {categoryLabels[category] || category}
                  </CardTitle>
                  <CardDescription>
                    {types.length} type(s) d'événement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Description req.</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {types.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell className="font-mono text-sm">
                              {type.code}
                            </TableCell>
                            <TableCell>{type.label}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={
                                  type.points >= 0
                                    ? 'bg-success/10 text-success border-success/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                                }
                              >
                                {type.points >= 0 ? '+' : ''}
                                {type.points} pts
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={type.is_active ? 'default' : 'secondary'}
                              >
                                {type.is_active ? 'Actif' : 'Inactif'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {type.requires_description ? (
                                <Badge variant="outline">Oui</Badge>
                              ) : (
                                <span className="text-muted-foreground">Non</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(type)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Dialog de création/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingType ? 'Modifier le type' : 'Nouveau type d\'événement'}
              </DialogTitle>
              <DialogDescription>
                Configurez les propriétés du type d'événement
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="INCIDENT_GMP"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="label">Libellé</Label>
                <Input
                  id="label"
                  placeholder="Incident GMP mineur"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: EventCategory) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  step="0.5"
                  value={formData.points}
                  onChange={(e) =>
                    setFormData({ ...formData, points: parseFloat(e.target.value) })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Valeur positive = bonus, négative = malus
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Type actif</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="requires_description">Description obligatoire</Label>
                <Switch
                  id="requires_description"
                  checked={formData.requires_description}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requires_description: checked })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingType ? 'Modifier' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
