import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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

export default function Import() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Récupérer les opérateurs pour la validation
  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, matricule, full_name');
      if (error) throw error;
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

  // Mutation pour importer les données
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Non authentifié');

      const retardType = eventTypes?.find((et) => et.code === 'RETARD_POINTAGE');
      const heuresSupType = eventTypes?.find((et) => et.code === 'HEURES_SUP');
      const weekendType = eventTypes?.find((et) => et.code === 'WEEKEND_TRAVAILLE');

      const events: any[] = [];

      for (const row of parsedData) {
        if (!row.operatorId) continue;

        // Retards
        for (let i = 0; i < row.retards; i++) {
          events.push({
            operator_id: row.operatorId,
            event_type_id: retardType?.id,
            created_by: profile.id,
            event_date: `${row.mois}-01`,
            status: 'approved',
            source: 'import',
            validated_by: profile.id,
          });
        }

        // Heures supplémentaires
        for (let i = 0; i < row.heures_sup; i++) {
          events.push({
            operator_id: row.operatorId,
            event_type_id: heuresSupType?.id,
            created_by: profile.id,
            event_date: `${row.mois}-01`,
            status: 'approved',
            source: 'import',
            validated_by: profile.id,
          });
        }

        // Weekends travaillés
        for (let i = 0; i < row.weekends; i++) {
          events.push({
            operator_id: row.operatorId,
            event_type_id: weekendType?.id,
            created_by: profile.id,
            event_date: `${row.mois}-01`,
            status: 'approved',
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

  const validRows = parsedData.filter((row) => row.operatorFound);
  const invalidRows = parsedData.filter((row) => !row.operatorFound);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import CSV/Excel</h1>
        <p className="text-muted-foreground mt-1">
          Importez les données de pointage mensuelles
        </p>
      </div>

      {/* Zone d'upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importer un fichier
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
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
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

      {/* Prévisualisation */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévisualisation</CardTitle>
            <CardDescription>
              {validRows.length} lignes valides, {invalidRows.length} lignes
              avec matricules non trouvés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
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
    </div>
  );
}
