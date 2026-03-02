import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Download, Users } from 'lucide-react';

interface ImportRow {
  matricule: string;
  mois: string;
  retards: number;
  heures_sup: number;
  weekends: number;
  operatorFound: boolean;
  operatorId?: string;
  operatorName?: string;
}

interface OperatorImportRow {
  matricule: string;
  full_name: string;
  unit: string;
  isValid: boolean;
  error?: string;
}

export default function Import() {
  const { profile } = useAuth();
  const { isFullAccess, canSeeOperator } = useHierarchyScope();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  
  const [operatorFile, setOperatorFile] = useState<File | null>(null);
  const [parsedOperators, setParsedOperators] = useState<OperatorImportRow[]>([]);

  // Récupérer les opérateurs pour la validation
  const { data: operators } = useQuery({
    queryKey: ['operators', isFullAccess],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, matricule, full_name');
      if (error) throw error;
      if (!isFullAccess && data) {
        return data.filter(op => canSeeOperator(op.id));
      }
      return data;
    },
  });

  // Récupérer les types d'événements nécessaires
  const { data: eventTypes } = useQuery({
    queryKey: ['event-types-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('id, code')
        .in('code', ['RETARD_POINTAGE', 'HEURES_SUP', 'WEEKEND_TRAVAILLE']);
      if (error) throw error;
      return data;
    },
  });

  // === IMPORT ÉVÉNEMENTS ===
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());
    
    if (lines.length < 2) {
      toast.error('Le fichier est vide ou mal formaté');
      return;
    }

    const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
    const matriculeIdx = headers.findIndex((h) => h.includes('matricule'));
    const moisIdx = headers.findIndex((h) => h.includes('mois'));
    const retardsIdx = headers.findIndex((h) => h.includes('retard'));
    const heuresSupIdx = headers.findIndex((h) => h.includes('heure') || h.includes('sup'));
    const weekendsIdx = headers.findIndex((h) => h.includes('weekend'));

    if (matriculeIdx === -1 || moisIdx === -1) {
      toast.error('Colonnes Matricule et Mois requises');
      return;
    }

    const data: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;]/).map((v) => v.trim());
      const matricule = values[matriculeIdx];
      
      const operator = operators?.find(
        (op) => op.matricule.toLowerCase() === matricule.toLowerCase()
      );

      data.push({
        matricule,
        mois: values[moisIdx] || '',
        retards: parseInt(values[retardsIdx]) || 0,
        heures_sup: parseInt(values[heuresSupIdx]) || 0,
        weekends: parseInt(values[weekendsIdx]) || 0,
        operatorFound: !!operator,
        operatorId: operator?.id,
        operatorName: operator?.full_name,
      });
    }

    setParsedData(data);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Non authentifié');

      const retardType = eventTypes?.find((et) => et.code === 'RETARD_POINTAGE');
      const heuresSupType = eventTypes?.find((et) => et.code === 'HEURES_SUP');
      const weekendType = eventTypes?.find((et) => et.code === 'WEEKEND_TRAVAILLE');

      const events: any[] = [];
      const now = new Date().toISOString();

      // Helper: get Saturdays of a given month (YYYY-MM)
      const getSaturdays = (mois: string): string[] => {
        const [year, month] = mois.split('-').map(Number);
        const saturdays: string[] = [];
        const date = new Date(year, month - 1, 1);
        while (date.getMonth() === month - 1) {
          if (date.getDay() === 6) {
            saturdays.push(`${mois}-${String(date.getDate()).padStart(2, '0')}`);
          }
          date.setDate(date.getDate() + 1);
        }
        return saturdays;
      };

      // Helper: get last day of month
      const getLastDay = (mois: string): number => {
        const [year, month] = mois.split('-').map(Number);
        return new Date(year, month, 0).getDate();
      };

      for (const row of parsedData) {
        if (!row.operatorId) continue;
        const lastDay = getLastDay(row.mois);

        // Retards: days 1, 2, 3... (capped to month length)
        for (let i = 0; i < row.retards; i++) {
          const day = Math.min(i + 1, lastDay);
          events.push({
            operator_id: row.operatorId,
            event_type_id: retardType?.id,
            created_by: profile.id,
            event_date: `${row.mois}-${String(day).padStart(2, '0')}`,
            status: 'approved',
            approved_at: now,
            source: 'import',
            validated_by: profile.id,
          });
        }

        // Heures sup: days 10, 11, 12... (capped to month length)
        for (let i = 0; i < row.heures_sup; i++) {
          const day = Math.min(10 + i, lastDay);
          events.push({
            operator_id: row.operatorId,
            event_type_id: heuresSupType?.id,
            created_by: profile.id,
            event_date: `${row.mois}-${String(day).padStart(2, '0')}`,
            status: 'approved',
            approved_at: now,
            source: 'import',
            validated_by: profile.id,
          });
        }

        // Weekends: on Saturdays of the month
        const saturdays = getSaturdays(row.mois);
        for (let i = 0; i < row.weekends; i++) {
          const eventDate = saturdays[i % saturdays.length] || `${row.mois}-${String(Math.min(20 + i, lastDay)).padStart(2, '0')}`;
          events.push({
            operator_id: row.operatorId,
            event_type_id: weekendType?.id,
            created_by: profile.id,
            event_date: eventDate,
            status: 'approved',
            approved_at: now,
            source: 'import',
            validated_by: profile.id,
          });
        }
      }

      if (events.length === 0) {
        throw new Error('Aucun événement à importer');
      }

      const { error } = await supabase.from('events').insert(events);
      if (error) throw error;

      return events.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`${count} événements importés avec succès`);
      setFile(null);
      setParsedData([]);
    },
    onError: (error: any) => {
      toast.error('Erreur d\'import', { description: error.message });
    },
  });

  // === IMPORT OPÉRATEURS ===
  const handleOperatorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setOperatorFile(selectedFile);
      parseOperatorCSV(selectedFile);
    }
  };

  const parseOperatorCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());
    
    if (lines.length < 2) {
      toast.error('Le fichier est vide ou mal formaté');
      return;
    }

    const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
    const matriculeIdx = headers.findIndex((h) => h.includes('matricule'));
    const nomIdx = headers.findIndex((h) => h.includes('nom') || h.includes('full_name') || h.includes('name'));
    const unitIdx = headers.findIndex((h) => h.includes('unit') || h.includes('unité') || h.includes('service'));

    if (matriculeIdx === -1 || nomIdx === -1 || unitIdx === -1) {
      toast.error('Colonnes Matricule, Nom et Unité requises');
      return;
    }

    const data: OperatorImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;]/).map((v) => v.trim());
      const matricule = values[matriculeIdx] || '';
      const full_name = values[nomIdx] || '';
      const unit = values[unitIdx] || '';

      const existingOperator = operators?.find(
        (op) => op.matricule.toLowerCase() === matricule.toLowerCase()
      );

      let error: string | undefined;
      if (!matricule) error = 'Matricule manquant';
      else if (!full_name) error = 'Nom manquant';
      else if (!unit) error = 'Unité manquante';
      else if (existingOperator) error = 'Matricule déjà existant';

      data.push({
        matricule,
        full_name,
        unit,
        isValid: !error,
        error,
      });
    }

    setParsedOperators(data);
  };

  const importOperatorsMutation = useMutation({
    mutationFn: async () => {
      const validOperators = parsedOperators.filter((op) => op.isValid);
      
      if (validOperators.length === 0) {
        throw new Error('Aucun opérateur valide à importer');
      }

      const { error } = await supabase.from('operators').insert(
        validOperators.map((op) => ({
          matricule: op.matricule,
          full_name: op.full_name,
          unit: op.unit,
        }))
      );

      if (error) throw error;
      return validOperators.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast.success(`${count} opérateurs importés avec succès`);
      setOperatorFile(null);
      setParsedOperators([]);
    },
    onError: (error: any) => {
      toast.error('Erreur d\'import', { description: error.message });
    },
  });

  // === TÉLÉCHARGEMENT TEMPLATES ===
  const downloadEventsTemplate = () => {
    const csvContent = 'Matricule;Mois;Retards;Heures_Sup;Weekends\nOP001;2025-01;2;3;1\nOP002;2025-01;1;5;2';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_evenements_mensuels.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadOperatorsTemplate = () => {
    const csvContent = 'Matricule;Nom;Unité\nOP001;Jean Dupont;Production\nOP002;Marie Martin;Conditionnement\nOP003;Ahmed Benali;Qualité';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_liste_employes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const validRows = parsedData.filter((row) => row.operatorFound);
  const invalidRows = parsedData.filter((row) => !row.operatorFound);
  const validOperators = parsedOperators.filter((op) => op.isValid);
  const invalidOperators = parsedOperators.filter((op) => !op.isValid);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import CSV/Excel</h1>
        <p className="text-muted-foreground mt-1">
          Importez les données de pointage et la liste des employés
        </p>
      </div>

      {/* Templates téléchargeables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Modèles à télécharger
          </CardTitle>
          <CardDescription>
            Téléchargez les modèles CSV vides pour préparer vos imports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={downloadOperatorsTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template Liste Employés
            </Button>
            <Button variant="outline" onClick={downloadEventsTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template Événements Mensuels
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="operators" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="operators">
            <Users className="h-4 w-4 mr-2" />
            Import Employés
          </TabsTrigger>
          <TabsTrigger value="events">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import Événements
          </TabsTrigger>
        </TabsList>

        {/* Import Opérateurs */}
        <TabsContent value="operators" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importer la liste des employés
              </CardTitle>
              <CardDescription>
                Format attendu: Matricule, Nom, Unité
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleOperatorFileChange}
                  className="hidden"
                  id="operator-file-upload"
                />
                <label
                  htmlFor="operator-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <Users className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {operatorFile ? operatorFile.name : 'Cliquez pour sélectionner un fichier'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Formats supportés: CSV, Excel
                    </p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {parsedOperators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prévisualisation Employés</CardTitle>
                <CardDescription>
                  {validOperators.length} lignes valides, {invalidOperators.length} lignes avec erreurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Statut</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedOperators.map((row, idx) => (
                        <TableRow
                          key={idx}
                          className={!row.isValid ? 'bg-destructive/5' : ''}
                        >
                          <TableCell>
                            {row.isValid ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{row.matricule}</TableCell>
                          <TableCell>{row.full_name}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell className="text-destructive text-sm">
                            {row.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOperatorFile(null);
                      setParsedOperators([]);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => importOperatorsMutation.mutate()}
                    disabled={validOperators.length === 0 || importOperatorsMutation.isPending}
                  >
                    {importOperatorsMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Importer {validOperators.length} employés
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Import Événements */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importer un fichier d'événements
              </CardTitle>
              <CardDescription>
                Format attendu: Matricule, Mois, Retards, Heures_Sup, Weekends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="event-file-upload"
                />
                <label
                  htmlFor="event-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {file ? file.name : 'Cliquez pour sélectionner un fichier'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Formats supportés: CSV, Excel
                    </p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {parsedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prévisualisation Événements</CardTitle>
                <CardDescription>
                  {validRows.length} lignes valides, {invalidRows.length} lignes avec matricules non trouvés
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Statut</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Opérateur</TableHead>
                        <TableHead>Mois</TableHead>
                        <TableHead className="text-right">Retards</TableHead>
                        <TableHead className="text-right">H. Sup</TableHead>
                        <TableHead className="text-right">Weekends</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((row, idx) => (
                        <TableRow
                          key={idx}
                          className={!row.operatorFound ? 'bg-destructive/5' : ''}
                        >
                          <TableCell>
                            {row.operatorFound ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{row.matricule}</TableCell>
                          <TableCell>
                            {row.operatorName || (
                              <span className="text-destructive">Non trouvé</span>
                            )}
                          </TableCell>
                          <TableCell>{row.mois}</TableCell>
                          <TableCell className="text-right">{row.retards}</TableCell>
                          <TableCell className="text-right">{row.heures_sup}</TableCell>
                          <TableCell className="text-right">{row.weekends}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setParsedData([]);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => importMutation.mutate()}
                    disabled={validRows.length === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Importer {validRows.length} lignes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
