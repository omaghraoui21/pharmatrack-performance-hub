import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHierarchyScope } from '@/hooks/useHierarchyScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Loader2, FileText, ArrowLeft, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function NewEvent() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isFullAccess, canSeeOperator } = useHierarchyScope();
  
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventTime, setEventTime] = useState('');
  const [shift, setShift] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [line, setLine] = useState('');
  const [lineId, setLineId] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Récupérer les opérateurs
  const { data: operators } = useQuery({
    queryKey: ['operators-active', isFullAccess],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, matricule, full_name, unit')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      // Filter by hierarchy scope on the client side
      if (!isFullAccess && data) {
        return data.filter(op => canSeeOperator(op.id));
      }
      return data;
    },
  });

  // Récupérer les types d'événements
  const { data: eventTypes } = useQuery({
    queryKey: ['event-types-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('label');

      if (error) throw error;
      return data;
    },
  });

  // Récupérer les shifts depuis la DB
  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, code, name')
        .order('code');
      if (error) throw error;
      return data;
    },
  });

  // Récupérer les lignes depuis la DB
  const { data: lines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('id, code, name')
        .order('code');
      if (error) throw error;
      return data;
    },
  });

  const selectedEventTypeData = eventTypes?.find((et) => et.id === selectedEventType);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Seules les images sont acceptées');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('L\'image ne doit pas dépasser 5 Mo');
        return;
      }
      setAttachmentFile(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  };

  // Mutation pour créer l'événement
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Non authentifié');

      let attachmentUrl: string | null = null;

      // Upload de la pièce jointe si présente
      if (attachmentFile) {
        setIsUploading(true);
        const fileExt = attachmentFile.name.split('.').pop();
        const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('event-attachments')
          .upload(fileName, attachmentFile);

        if (uploadError) throw new Error('Erreur lors de l\'upload de l\'image');

        const { data: publicUrlData } = supabase.storage
          .from('event-attachments')
          .getPublicUrl(fileName);

        attachmentUrl = publicUrlData.publicUrl;
        setIsUploading(false);
      }

      const { error } = await supabase.from('events').insert({
        operator_id: selectedOperator,
        event_type_id: selectedEventType,
        created_by: profile.id,
        event_date: eventDate,
        event_time: eventTime || null,
        shift: shift || null,
        shift_id: shiftId || null,
        line: line || null,
        line_id: lineId || null,
        description: description || null,
        attachment_url: attachmentUrl,
        status: 'pending',
        source: 'manual',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Événement créé', {
        description: 'L\'événement a été soumis pour validation.',
      });
      navigate('/dashboard');
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast.error('Erreur', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOperator || !selectedEventType) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (selectedEventTypeData?.requires_description && !description.trim()) {
      toast.error('La description est obligatoire pour ce type d\'événement');
      return;
    }

    createMutation.mutate();
  };

  const selectedOperatorData = operators?.find((op) => op.id === selectedOperator);

  const groupedEventTypes = eventTypes?.reduce((acc, et) => {
    const category = et.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(et);
    return acc;
  }, {} as Record<string, typeof eventTypes>);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Saisir un événement</h1>
          <p className="text-muted-foreground mt-1">
            Enregistrez un événement pour un opérateur
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Nouvel événement
          </CardTitle>
          <CardDescription>
            Remplissez les informations de l'événement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection opérateur */}
            <div className="space-y-2">
              <Label>Opérateur *</Label>
              <Popover open={operatorOpen} onOpenChange={setOperatorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={operatorOpen}
                    className="w-full justify-between"
                  >
                    {selectedOperatorData
                      ? `${selectedOperatorData.matricule} - ${selectedOperatorData.full_name}`
                      : 'Sélectionner un opérateur...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher par matricule ou nom..." />
                    <CommandList>
                      <CommandEmpty>Aucun opérateur trouvé.</CommandEmpty>
                      <CommandGroup>
                        {operators?.map((op) => (
                          <CommandItem
                            key={op.id}
                            value={`${op.matricule} ${op.full_name}`}
                            onSelect={() => {
                              setSelectedOperator(op.id);
                              setOperatorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedOperator === op.id
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <span className="font-mono mr-2">{op.matricule}</span>
                            <span>{op.full_name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {op.unit}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sélection type d'événement */}
            <div className="space-y-2">
              <Label>Type d'événement *</Label>
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type..." />
                </SelectTrigger>
                <SelectContent>
                  {groupedEventTypes &&
                    Object.entries(groupedEventTypes).map(([category, types]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {categoryLabels[category] || category}
                        </div>
                        {types?.map((et) => (
                          <SelectItem key={et.id} value={et.id}>
                            <div className="flex items-center gap-2">
                              <span>{et.label}</span>
                              <Badge
                                variant="outline"
                                className={
                                  et.points >= 0
                                    ? 'bg-success/10 text-success border-success/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                                }
                              >
                                {et.points >= 0 ? '+' : ''}
                                {et.points} pts
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                </SelectContent>
              </Select>
              {selectedEventTypeData?.requires_description && (
                <p className="text-sm text-warning">
                  ⚠️ Ce type d'événement nécessite une description obligatoire
                </p>
              )}
            </div>

            {/* Date et heure */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_time">Heure</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
            </div>

            {/* Équipe et ligne */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift">Équipe (shift)</Label>
                <Select value={shiftId} onValueChange={(val) => {
                  setShiftId(val);
                  const s = shifts?.find(s => s.id === val);
                  setShift(s?.name || s?.code || '');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name || s.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="line">Ligne</Label>
                <Select value={lineId} onValueChange={(val) => {
                  setLineId(val);
                  const l = lines?.find(l => l.id === val);
                  setLine(l?.name || l?.code || '');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lines?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pièce jointe photo */}
            <div className="space-y-2">
              <Label>Pièce jointe (photo)</Label>
              {attachmentPreview ? (
                <div className="relative inline-block">
                  <img
                    src={attachmentPreview}
                    alt="Aperçu"
                    className="max-w-xs max-h-48 rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeAttachment}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="attachment-upload"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Cliquez pour ajouter une photo (max 5 Mo)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description{' '}
                {selectedEventTypeData?.requires_description && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Textarea
                id="description"
                placeholder="Décrivez l'événement en détail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required={selectedEventTypeData?.requires_description}
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || isUploading}
                className="flex-1"
              >
                {(createMutation.isPending || isUploading) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isUploading ? 'Upload en cours...' : 'Soumettre l\'événement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
