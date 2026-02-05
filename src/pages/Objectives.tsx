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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Plus, Pencil, Trash2, Loader2, TrendingUp, CheckCircle2, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Objective {
  id: string;
  owner_profile_id: string;
  period_start: string;
  period_end: string;
  title: string;
  description: string | null;
  weight: number;
  target_type: string | null;
  target_value: number | null;
  actual_value: number | null;
  score_0_100: number | null;
  status: string;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
}

const KPI_TEMPLATES = [
  { title: 'Discipline retards/100j', target_type: 'count', description: 'Nombre de retards pour 100 jours travaillés' },
  { title: 'Déviations mineures/mois', target_type: 'count', description: 'Nombre de déviations mineures par mois' },
  { title: 'Déviations majeures/mois', target_type: 'count', description: 'Nombre de déviations majeures par mois' },
  { title: 'SLA validation <48h', target_type: 'percentage', description: 'Pourcentage d\'événements validés en moins de 48h' },
  { title: 'CAPA on-time %', target_type: 'percentage', description: 'Pourcentage de CAPA terminés dans les délais' },
  { title: 'Erreurs documentation/100', target_type: 'ratio', description: 'Ratio d\'erreurs documentation pour 100 documents' },
];

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'outline' },
  submitted: { label: 'Soumis', variant: 'secondary' },
  approved: { label: 'Approuvé', variant: 'default' },
};

export default function Objectives() {
  const { profile, isManager } = useAuth();
  const queryClient = useQueryClient();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [weight, setWeight] = useState('1.0');
  const [targetType, setTargetType] = useState('count');
  const [targetValue, setTargetValue] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [score, setScore] = useState('');

  // Fetch objectives
  const { data: objectives, isLoading } = useQuery({
    queryKey: ['objectives', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objectives')
        .select('*')
        .order('period_start', { ascending: false });
      if (error) throw error;
      return data as Objective[];
    },
    enabled: !!profile?.id,
  });

  // Filter objectives for current user (unless manager)
  const displayedObjectives = isManager 
    ? objectives 
    : objectives?.filter(o => o.owner_profile_id === profile?.id);

  // Calculate weighted score
  const calculateWeightedScore = () => {
    if (!displayedObjectives?.length) return null;
    const approvedWithScore = displayedObjectives.filter(o => o.status === 'approved' && o.score_0_100 !== null);
    if (!approvedWithScore.length) return null;
    
    const totalWeight = approvedWithScore.reduce((sum, o) => sum + (o.weight || 1), 0);
    const weightedSum = approvedWithScore.reduce((sum, o) => sum + (o.score_0_100 || 0) * (o.weight || 1), 0);
    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(1) : null;
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Objective> & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('objectives')
          .update({
            title: data.title,
            description: data.description,
            period_start: data.period_start,
            period_end: data.period_end,
            weight: data.weight,
            target_type: data.target_type,
            target_value: data.target_value,
            actual_value: data.actual_value,
            score_0_100: data.score_0_100,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('objectives')
          .insert({
            owner_profile_id: profile?.id,
            title: data.title,
            description: data.description,
            period_start: data.period_start,
            period_end: data.period_end,
            weight: data.weight,
            target_type: data.target_type,
            target_value: data.target_value,
            actual_value: data.actual_value,
            score_0_100: data.score_0_100,
            status: 'draft',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingObjective ? 'Objectif modifié' : 'Objectif créé');
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      resetDialog();
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('objectives')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objectives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Objectif supprimé');
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: (error: any) => toast.error('Erreur', { description: error.message }),
  });

  const openDialog = (objective?: Objective) => {
    if (objective) {
      setEditingObjective(objective);
      setTitle(objective.title);
      setDescription(objective.description || '');
      setPeriodStart(objective.period_start);
      setPeriodEnd(objective.period_end);
      setWeight(String(objective.weight || 1));
      setTargetType(objective.target_type || 'count');
      setTargetValue(String(objective.target_value || ''));
      setActualValue(String(objective.actual_value || ''));
      setScore(String(objective.score_0_100 || ''));
    } else {
      setEditingObjective(null);
      setTitle('');
      setDescription('');
      setPeriodStart('');
      setPeriodEnd('');
      setWeight('1.0');
      setTargetType('count');
      setTargetValue('');
      setActualValue('');
      setScore('');
    }
    setShowDialog(true);
  };

  const resetDialog = () => {
    setShowDialog(false);
    setEditingObjective(null);
  };

  const applyTemplate = (template: typeof KPI_TEMPLATES[0]) => {
    setTitle(template.title);
    setDescription(template.description);
    setTargetType(template.target_type);
  };

  const handleSave = () => {
    if (!title.trim() || !periodStart || !periodEnd) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    saveMutation.mutate({
      id: editingObjective?.id,
      title,
      description: description || null,
      period_start: periodStart,
      period_end: periodEnd,
      weight: parseFloat(weight) || 1,
      target_type: targetType,
      target_value: targetValue ? parseFloat(targetValue) : null,
      actual_value: actualValue ? parseFloat(actualValue) : null,
      score_0_100: score ? parseFloat(score) : null,
    });
  };

  const weightedScore = calculateWeightedScore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Objectifs</h1>
          <p className="text-muted-foreground mt-1">
            Définissez et suivez vos objectifs de performance
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel objectif
        </Button>
      </div>

      {/* Score Summary */}
      {weightedScore && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Score pondéré global</p>
                  <p className="text-3xl font-bold text-primary">{weightedScore}/100</p>
                </div>
              </div>
              <Progress value={parseFloat(weightedScore)} className="w-1/3" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mes objectifs
          </CardTitle>
          <CardDescription>
            Objectifs de la période en cours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayedObjectives && displayedObjectives.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objectif</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Poids</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Réalisé</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedObjectives.map((obj) => (
                    <TableRow key={obj.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{obj.title}</p>
                          {obj.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{obj.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(obj.period_start), 'dd/MM/yy', { locale: fr })} - {format(new Date(obj.period_end), 'dd/MM/yy', { locale: fr })}
                      </TableCell>
                      <TableCell>{obj.weight}</TableCell>
                      <TableCell>{obj.target_value ?? '-'}</TableCell>
                      <TableCell>{obj.actual_value ?? '-'}</TableCell>
                      <TableCell>
                        {obj.score_0_100 !== null ? (
                          <Badge variant={obj.score_0_100 >= 80 ? 'default' : 'secondary'}>
                            {obj.score_0_100}/100
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[obj.status]?.variant || 'outline'}>
                          {statusLabels[obj.status]?.label || obj.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {obj.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: obj.id, status: 'submitted' })}
                              title="Soumettre"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {isManager && obj.status === 'submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-success"
                              onClick={() => updateStatusMutation.mutate({ id: obj.id, status: 'approved' })}
                              title="Approuver"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openDialog(obj)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isManager && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(obj.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun objectif défini</p>
              <p className="text-sm">Créez vos premiers objectifs de performance</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objective Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingObjective ? 'Modifier l\'objectif' : 'Nouvel objectif'}</DialogTitle>
            <DialogDescription>
              {editingObjective ? 'Modifiez les détails de l\'objectif' : 'Définissez un nouvel objectif de performance'}
            </DialogDescription>
          </DialogHeader>

          {/* Templates */}
          {!editingObjective && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Templates KPI</Label>
              <div className="flex flex-wrap gap-2">
                {KPI_TEMPLATES.map((t, i) => (
                  <Button key={i} size="sm" variant="outline" onClick={() => applyTemplate(t)}>
                    {t.title}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'objectif" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Début période *</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fin période *</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Poids</Label>
                <Input type="number" step="0.1" min="0.1" max="5" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Nombre</SelectItem>
                    <SelectItem value="percentage">Pourcentage</SelectItem>
                    <SelectItem value="ratio">Ratio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valeur cible</Label>
                <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valeur réalisée</Label>
                <Input type="number" value={actualValue} onChange={(e) => setActualValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Score (0-100)</Label>
                <Input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Annuler</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingObjective ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
