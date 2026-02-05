import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Download, Loader2, Medal, AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function Ranking() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  // Récupérer le classement via RPC
  const { data: ranking, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ranking', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_year_ranking', { p_year: parseInt(selectedYear) });

      if (error) {
        console.error('[Ranking] supabase error:', error);
        throw error;
      }
      
      return (data as RankingEntry[]) || [];
    },
    retry: 1,
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = () => {
    if (!ranking) return;

    const headers = ['Rang', 'Matricule', 'Nom', 'Unité', 'Points bruts', 'Score/100', 'Note/20', 'Postes maîtrisés'];
    const rows = ranking.map((entry, index) => [
      index + 1,
      entry.matricule,
      entry.full_name,
      entry.unit,
      Number(entry.raw_points).toFixed(1),
      Number(entry.score100).toFixed(1),
      Number(entry.note20).toFixed(1),
      entry.positions_count,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `classement_${selectedYear}.csv`;
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

        <div className="flex items-center gap-4">
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

          <Button variant="outline" onClick={handleExport} disabled={!ranking?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Classement {selectedYear}
          </CardTitle>
          <CardDescription>
            Classement basé sur les événements approuvés. Score de base: 80/100.
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
          ) : ranking && ranking.length > 0 ? (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((entry, index) => (
                    <TableRow key={entry.operator_id}>
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
                      <TableCell className="font-medium">{entry.full_name}</TableCell>
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
