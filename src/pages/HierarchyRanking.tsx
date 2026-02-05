import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Users2, Trophy, AlertTriangle, Clock } from 'lucide-react';

type SupervisorRanking = {
  supervisor_id: string;
  supervisor_name: string;
  unit_name: string | null;
  operators_count: number;
  avg_team_score: number;
  pending_events: number;
  avg_validation_delay_hours: number;
  major_deviations: number;
  supervisor_score: number;
  rank: number;
};

type ManagerRanking = {
  manager_id: string;
  manager_name: string;
  unit_name: string | null;
  operators_count: number;
  avg_unit_score: number;
  major_deviation_rate: number;
  avg_validation_delay_hours: number;
  manager_score: number;
  rank: number;
};

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

export default function HierarchyRanking() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisorRanking, isLoading: supervisorsLoading } = useQuery({
    queryKey: ['supervisor-ranking', selectedYear, selectedUnit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_supervisor_ranking', {
        p_year: selectedYear,
        p_unit_id: selectedUnit === 'all' ? null : selectedUnit,
      });
      if (error) throw error;
      return data as SupervisorRanking[];
    },
  });

  const { data: managerRanking, isLoading: managersLoading } = useQuery({
    queryKey: ['manager-ranking', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_manager_ranking', {
        p_year: selectedYear,
      });
      if (error) throw error;
      return data as ManagerRanking[];
    },
  });

  const exportSupervisorsCSV = () => {
    if (!supervisorRanking?.length) return;
    const headers = ['Rang', 'Superviseur', 'Unité', 'Opérateurs', 'Score Équipe', 'Score Final', 'En attente', 'Délai (h)', 'Déviations'];
    const rows = supervisorRanking.map((s) => [
      s.rank,
      s.supervisor_name,
      s.unit_name || '-',
      s.operators_count,
      s.avg_team_score,
      s.supervisor_score,
      s.pending_events,
      s.avg_validation_delay_hours,
      s.major_deviations,
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classement-superviseurs-${selectedYear}.csv`;
    a.click();
  };

  const exportManagersCSV = () => {
    if (!managerRanking?.length) return;
    const headers = ['Rang', 'Manager', 'Unité', 'Opérateurs', 'Score Équipe', 'Score Final', 'Taux Dév. (%)', 'Délai (h)'];
    const rows = managerRanking.map((m) => [
      m.rank,
      m.manager_name,
      m.unit_name || '-',
      m.operators_count,
      m.avg_unit_score,
      m.manager_score,
      m.major_deviation_rate,
      m.avg_validation_delay_hours,
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classement-managers-${selectedYear}.csv`;
    a.click();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-black">🥇 1er</Badge>;
    if (rank === 2) return <Badge className="bg-gray-300 text-black">🥈 2e</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-white">🥉 3e</Badge>;
    return <Badge variant="outline">{rank}e</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 font-bold';
    if (score >= 70) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classement Hiérarchique</h1>
          <p className="text-muted-foreground">Performance des superviseurs et managers</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="supervisors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="supervisors" className="gap-2">
            <Users2 className="h-4 w-4" />
            Superviseurs
          </TabsTrigger>
          <TabsTrigger value="managers" className="gap-2">
            <Trophy className="h-4 w-4" />
            Managers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supervisors" className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Toutes les unités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les unités</SelectItem>
                {units?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportSupervisorsCSV} disabled={!supervisorRanking?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5" />
                Classement Superviseurs {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supervisorsLoading ? (
                <p className="text-center py-8 text-muted-foreground">Chargement...</p>
              ) : !supervisorRanking?.length ? (
                <p className="text-center py-8 text-muted-foreground">Aucun superviseur avec des opérateurs assignés</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Rang</TableHead>
                      <TableHead>Superviseur</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-center">Opérateurs</TableHead>
                      <TableHead className="text-center">Score Équipe</TableHead>
                      <TableHead className="text-center">Score Final</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          En attente
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          Délai (h)
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Déviations
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisorRanking.map((s) => (
                      <TableRow key={s.supervisor_id}>
                        <TableCell>{getRankBadge(s.rank)}</TableCell>
                        <TableCell className="font-medium">{s.supervisor_name}</TableCell>
                        <TableCell>{s.unit_name || '-'}</TableCell>
                        <TableCell className="text-center">{s.operators_count}</TableCell>
                        <TableCell className={`text-center ${getScoreColor(s.avg_team_score)}`}>
                          {s.avg_team_score.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center ${getScoreColor(s.supervisor_score)}`}>
                          {s.supervisor_score.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.pending_events > 5 ? (
                            <Badge variant="destructive">{s.pending_events}</Badge>
                          ) : (
                            s.pending_events
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.avg_validation_delay_hours > 48 ? (
                            <span className="text-red-600 font-semibold">{s.avg_validation_delay_hours.toFixed(1)}</span>
                          ) : (
                            s.avg_validation_delay_hours.toFixed(1)
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.major_deviations > 0 ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              {s.major_deviations}
                            </Badge>
                          ) : (
                            0
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="managers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportManagersCSV} disabled={!managerRanking?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Classement Managers {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {managersLoading ? (
                <p className="text-center py-8 text-muted-foreground">Chargement...</p>
              ) : !managerRanking?.length ? (
                <p className="text-center py-8 text-muted-foreground">Aucun manager trouvé</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Rang</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-center">Opérateurs</TableHead>
                      <TableHead className="text-center">Score Équipe</TableHead>
                      <TableHead className="text-center">Score Final</TableHead>
                      <TableHead className="text-center">Taux Dév. (%)</TableHead>
                      <TableHead className="text-center">Délai (h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managerRanking.map((m) => (
                      <TableRow key={m.manager_id}>
                        <TableCell>{getRankBadge(m.rank)}</TableCell>
                        <TableCell className="font-medium">{m.manager_name}</TableCell>
                        <TableCell>{m.unit_name || '-'}</TableCell>
                        <TableCell className="text-center">{m.operators_count}</TableCell>
                        <TableCell className={`text-center ${getScoreColor(m.avg_unit_score)}`}>
                          {m.avg_unit_score.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center ${getScoreColor(m.manager_score)}`}>
                          {m.manager_score.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center">
                          {m.major_deviation_rate > 5 ? (
                            <span className="text-red-600 font-semibold">{m.major_deviation_rate.toFixed(2)}%</span>
                          ) : (
                            `${m.major_deviation_rate.toFixed(2)}%`
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {m.avg_validation_delay_hours > 48 ? (
                            <span className="text-red-600 font-semibold">{m.avg_validation_delay_hours.toFixed(1)}</span>
                          ) : (
                            m.avg_validation_delay_hours.toFixed(1)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Formule de calcul du score Manager</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p><strong>Score = 60% Score Équipe + 20% Discipline + 20% Réactivité</strong></p>
              <p>• Discipline = 100 - (taux déviations majeures × 10)</p>
              <p>• Réactivité = 100 - (délai validation / 48h × 100), plafonné à 100%</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
