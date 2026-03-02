import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHierarchyScope } from '@/hooks/useHierarchyScope';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trophy, Download, Loader2, Medal, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RankingEntry {
  operator_id: string;
  matricule: string;
  full_name: string;
  unit: string;
  raw_points: number;
  score100: number;
  note20: number;
  positions_count: number;
  approved_events: number;
  work_days: number;
}

interface Unit {
  id: string;
  name: string;
}

export default function Ranking() {
  const { isFullAccess, canSeeOperator } = useHierarchyScope();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [hideUnder60Days, setHideUnder60Days] = useState(false);

  // Fetch units
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Récupérer le classement via RPC
  const { data: ranking, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ranking', selectedYear, selectedUnit],
    queryFn: async () => {
      const params: { p_year: number; p_unit_id?: string } = { 
        p_year: parseInt(selectedYear) 
      };
      
      // Note: The RPC now accepts p_unit_id but we filter client-side for unit name matching
      const { data, error } = await supabase
        .rpc('get_year_ranking', params);

      if (error) {
        console.error('[Ranking] supabase error:', error);
        throw error;
      }
      
      return (data as RankingEntry[]) || [];
    },
    retry: 1,
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Filter by unit and work_days
  const filteredRanking = ranking?.filter((entry) => {
    const matchesUnit = selectedUnit === 'all' || entry.unit === selectedUnit;
    const meetsWorkDays = !hideUnder60Days || entry.work_days >= 60;
    const isVisible = isFullAccess || canSeeOperator(entry.operator_id);
    return matchesUnit && meetsWorkDays && isVisible;
  });

  const handleExport = () => {
    if (!filteredRanking) return;

    const headers = ['Rang', 'Matricule', 'Nom', 'Unité', 'Points bruts', 'Score/100', 'Note/20', 'Postes maîtrisés', 'Jours travaillés'];
    const rows = filteredRanking.map((entry, index) => [
      index + 1,
      entry.matricule,
      entry.full_name,
      entry.unit,
      Number(entry.raw_points).toFixed(1),
      Number(entry.score100).toFixed(1),
      Number(entry.note20).toFixed(1),
      entry.positions_count,
      entry.work_days,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `classement_${selectedYear}${selectedUnit !== 'all' ? `_${selectedUnit}` : ''}.csv`;
    link.click();
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-500';
      case 2:
        return 'text-gray-400';
      case 3:
        return 'text-amber-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Classement annuel</h1>
          <p className="text-muted-foreground mt-1">
            Performance des opérateurs sur l'année
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Unité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les unités</SelectItem>
              {units?.map((unit) => (
                <SelectItem key={unit.id} value={unit.name}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport} disabled={!filteredRanking?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Filter options */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="hide-under-60"
          checked={hideUnder60Days}
          onCheckedChange={(checked) => setHideUnder60Days(checked as boolean)}
        />
        <Label htmlFor="hide-under-60" className="text-sm text-muted-foreground cursor-pointer">
          Masquer les opérateurs avec moins de 60 jours travaillés
        </Label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Classement {selectedYear}
            {selectedUnit !== 'all' && (
              <Badge variant="secondary">{selectedUnit}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Classement basé sur les événements approuvés. Score de base: 80/100. Cap bonus: +1.5/jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur de chargement</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error?.message || 'Impossible de charger le classement'}</span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          ) : filteredRanking && filteredRanking.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Rang</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead className="text-right">Points bruts</TableHead>
                    <TableHead className="text-right">Score/100</TableHead>
                    <TableHead className="text-right">Note/20</TableHead>
                    <TableHead className="text-right">Postes</TableHead>
                    <TableHead className="text-right">Jours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRanking.map((entry, index) => (
                    <TableRow 
                      key={entry.operator_id}
                      className={entry.work_days < 60 ? 'opacity-60' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index < 3 ? (
                            <Medal className={`h-5 w-5 ${getMedalColor(index + 1)}`} />
                          ) : (
                            <span className="w-5 text-center font-medium">
                              {index + 1}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{entry.matricule}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {entry.full_name}
                          {entry.work_days < 60 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Clock className="h-4 w-4 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Moins de 60 jours travaillés ({entry.work_days}j)</p>
                                  <p className="text-xs text-muted-foreground">Non éligible au classement officiel</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entry.unit}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            Number(entry.raw_points) >= 0
                              ? 'text-success'
                              : 'text-destructive'
                          }
                        >
                          {Number(entry.raw_points) >= 0 ? '+' : ''}
                          {Number(entry.raw_points).toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(entry.score100).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={Number(entry.note20) >= 16 ? 'default' : 'outline'}
                          className={
                            Number(entry.note20) >= 16
                              ? 'bg-success text-success-foreground'
                              : Number(entry.note20) >= 12
                              ? 'bg-primary text-primary-foreground'
                              : ''
                          }
                        >
                          {Number(entry.note20).toFixed(1)}/20
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {entry.positions_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={entry.work_days < 60 ? 'text-warning' : 'text-muted-foreground'}>
                          {entry.work_days}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune donnée pour {selectedYear}</p>
              <p className="text-sm">Les événements approuvés apparaîtront ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
