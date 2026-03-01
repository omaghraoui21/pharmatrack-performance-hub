import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  User, 
  Briefcase, 
  Plus, 
  Pencil, 
  Trash2,
  Loader2,
  Save,
  Building2,
  Users
} from 'lucide-react';
import { ReferentialsTab } from '@/components/settings/ReferentialsTab';
import { AssignmentsTab } from '@/components/settings/AssignmentsTab';
import { UsersTab } from '@/components/settings/UsersTab';

export default function Settings() {
  const { profile, isManager } = useAuth();
  const queryClient = useQueryClient();
  
  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Position dialog state
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [positionName, setPositionName] = useState('');
  const [positionDescription, setPositionDescription] = useState('');

  // Fetch positions
  const { data: positions, isLoading: loadingPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', profile?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Create/update position mutation
  const savePositionMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id?: string; name: string; description: string }) => {
      if (id) {
        const { error } = await supabase
          .from('positions')
          .update({ name, description })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('positions')
          .insert({ name, description });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPosition ? 'Poste modifié' : 'Poste créé');
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      resetPositionDialog();
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Delete position mutation
  const deletePositionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Poste supprimé');
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Le nom ne peut pas être vide');
      return;
    }
    setIsUpdatingProfile(true);
    await updateProfileMutation.mutateAsync(fullName);
    setIsUpdatingProfile(false);
  };

  const handleOpenPositionDialog = (position?: any) => {
    if (position) {
      setEditingPosition(position);
      setPositionName(position.name);
      setPositionDescription(position.description || '');
    } else {
      setEditingPosition(null);
      setPositionName('');
      setPositionDescription('');
    }
    setShowPositionDialog(true);
  };

  const resetPositionDialog = () => {
    setShowPositionDialog(false);
    setEditingPosition(null);
    setPositionName('');
    setPositionDescription('');
  };

  const handleSavePosition = () => {
    if (!positionName.trim()) {
      toast.error('Le nom du poste est requis');
      return;
    }
    savePositionMutation.mutate({
      id: editingPosition?.id,
      name: positionName,
      description: positionDescription,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Gérez votre profil et les paramètres de l'application
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Mon profil
          </TabsTrigger>
          {isManager && (
            <>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Utilisateurs
              </TabsTrigger>
              <TabsTrigger value="positions" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Postes
              </TabsTrigger>
              <TabsTrigger value="referentials" className="gap-2">
                <Building2 className="h-4 w-4" />
                Référentiels
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2">
                <Users className="h-4 w-4" />
                Affectations
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Onglet Profil */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations du profil
              </CardTitle>
              <CardDescription>
                Modifiez vos informations personnelles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'email ne peut pas être modifié
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom complet"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Input
                    value={profile?.role === 'manager' ? 'Manager' : 'Superviseur'}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <Button 
                  onClick={handleUpdateProfile}
                  disabled={isUpdatingProfile || fullName === profile?.full_name}
                  className="w-fit"
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Utilisateurs (Manager only) */}
        {isManager && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}

        {/* Onglet Postes (Manager only) */}
        {isManager && (
          <TabsContent value="positions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Gestion des postes
                    </CardTitle>
                    <CardDescription>
                      Définissez les postes pour la polyvalence des opérateurs
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenPositionDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau poste
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPositions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : positions && positions.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">
                              {position.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {position.description || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenPositionDialog(position)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deletePositionMutation.mutate(position.id)}
                                  disabled={deletePositionMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun poste défini</p>
                    <p className="text-sm">Créez des postes pour gérer la polyvalence</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Onglet Référentiels (Manager only) */}
        {isManager && (
          <TabsContent value="referentials">
            <ReferentialsTab />
          </TabsContent>
        )}

        {/* Onglet Affectations (Manager only) */}
        {isManager && (
          <TabsContent value="assignments">
            <AssignmentsTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog Poste */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? 'Modifier le poste' : 'Nouveau poste'}
            </DialogTitle>
            <DialogDescription>
              {editingPosition 
                ? 'Modifiez les informations du poste'
                : 'Créez un nouveau poste pour la polyvalence'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="position_name">Nom du poste *</Label>
              <Input
                id="position_name"
                value={positionName}
                onChange={(e) => setPositionName(e.target.value)}
                placeholder="Ex: Conducteur de ligne"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position_description">Description</Label>
              <Textarea
                id="position_description"
                value={positionDescription}
                onChange={(e) => setPositionDescription(e.target.value)}
                placeholder="Description du poste..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetPositionDialog}>
              Annuler
            </Button>
            <Button
              onClick={handleSavePosition}
              disabled={savePositionMutation.isPending}
            >
              {savePositionMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPosition ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
