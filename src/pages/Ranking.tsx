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
import { Trophy, Download, Loader2, Medal } from 'lucide-react';

interface RankingEntry {
  operatorId: string;
  matricule: string;
  fullName: string;
  unit: string;
  rawPoints: number;
  score100: number;
  note20: number;
  positionsCount: number;
  approvedEvents: number;
}

export default function Ranking() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  // Récupérer le classement
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['ranking', selectedYear],
    queryFn: async () => {
      // Récupérer tous les opérateurs actifs
      const { data: operators, error: opError } = await supabase
        .from('operators')
        .select('id, matricule, full_name, unit')
        .eq('is_active', true);

      if (opError) throw opError;

      // Récupérer tous les événements approuvés de l'année
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data: events, error: evError } = await supabase
        .from('events')
        .select(`
          operator_id,
          event_date,
          event_type:event_types(points)
        `)
        .eq('status', 'approved')
        .gte('event_date', startDate)
        .lte('event_date', endDate);

      if (evError) throw evError;

      // Récupérer les postes maîtrisés par opérateur
      const { data: positions, error: posError } = await supabase
        .from('operator_positions')
        .select('operator_id');

      if (posError) throw posError;

      // Calculer les points par opérateur
      const operatorPoints: Record<
        string,
        {
          rawPoints: number;
          approvedEvents: number;
          workDays: Set<string>;
        }
      > = {};

      events?.forEach((event: any) => {
        const opId = event.operator_id;
        if (!operatorPoints[opId]) {
          operatorPoints[opId] = {
            rawPoints: 0,
            approvedEvents: 0,
            workDays: new Set(),
          };
        }
        operatorPoints[opId].rawPoints += Number(event.event_type?.points || 0);
        operatorPoints[opId].approvedEvents += 1;
        operatorPoints[opId].workDays.add(event.event_date);
      });

      // Compter les postes par opérateur
      const positionsCount: Record<string, number> = {};
      positions?.forEach((p) => {
        positionsCount[p.operator_id] = (positionsCount[p.operator_id] || 0) + 1;
      });

      // Calculer le classement
      const rankingData: RankingEntry[] = operators
        ?.map((op) => {
          const data = operatorPoints[op.id] || {
            rawPoints: 0,
            approvedEvents: 0,
            workDays: new Set(),
          };

          // Bonus polyvalence: +0.5 par poste au-delà de 2
          const posCount = positionsCount[op.id] || 0;
          const polyvalenceBonus = Math.max(0, posCount - 2) * 0.5;

          const rawPoints = data.rawPoints + polyvalenceBonus;
          const score100 = Math.max(0, Math.min(100, 80 + rawPoints));
          const note20 = Math.round((score100 / 5) * 10) / 10;

          return {
            operatorId: op.id,
            matricule: op.matricule,
            fullName: op.full_name,
            unit: op.unit,
            rawPoints,
            score100,
            note20,
            positionsCount: posCount,
            approvedEvents: data.approvedEvents,
          };
        })
        .sort((a, b) => b.score100 - a.score100);

      return rankingData;
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = () => {
    if (!ranking) return;

    const headers = ['Rang', 'Matricule', 'Nom', 'Unité', 'Points bruts', 'Score/100', 'Note/20', 'Postes maîtrisés'];
    const rows = ranking.map((entry, index) => [
      index + 1,
      entry.matricule,
      entry.fullName,
      entry.unit,
      entry.rawPoints.toFixed(1),
      entry.score100.toFixed(1),
      entry.note20.toFixed(1),
      entry.positionsCount,
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
                    <TableRow key={entry.operatorId}>
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
                      <TableCell className="font-medium">{entry.fullName}</TableCell>
                      <TableCell>{entry.unit}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            entry.rawPoints >= 0
                              ? 'text-success'
                              : 'text-destructive'
                          }
                        >
                          {entry.rawPoints >= 0 ? '+' : ''}
                          {entry.rawPoints.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.score100.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={entry.note20 >= 16 ? 'default' : 'outline'}
                          className={
                            entry.note20 >= 16
                              ? 'bg-success text-success-foreground'
                              : entry.note20 >= 12
                              ? 'bg-primary text-primary-foreground'
                              : ''
                          }
                        >
                          {entry.note20.toFixed(1)}/20
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {entry.positionsCount}
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
