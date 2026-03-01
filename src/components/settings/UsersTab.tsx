import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Shield, Loader2, Users, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type UserRole = Database['public']['Enums']['user_role'];

const APP_ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'admin_site', label: 'Admin Site', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'manager_unite', label: 'Manager Unité', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'superviseur', label: 'Superviseur', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'readonly', label: 'Lecture seule', color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

interface ProfileWithRoles {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  unit_id: string | null;
  is_active: boolean | null;
  roles: AppRole[];
  unit_name?: string;
}

export function UsersTab() {
  const { profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();

  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithRoles | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('supervisor');
  const [inviteUnitId, setInviteUnitId] = useState<string>('none');
  const [inviteAppRoles, setInviteAppRoles] = useState<AppRole[]>([]);

  // Edit form
  const [editFullName, setEditFullName] = useState('');
  const [editUnitId, setEditUnitId] = useState<string>('none');
  const [editIsActive, setEditIsActive] = useState(true);

  // Roles form
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);

  // Fetch units
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const { data: unitsData } = await supabase.from('units').select('id, name');
      const unitsMap = new Map(unitsData?.map((u) => [u.id, u.name]) || []);

      return profiles.map((p) => ({
        ...p,
        roles: (allRoles?.filter((r) => r.user_id === p.id).map((r) => r.role) || []) as AppRole[],
        unit_name: p.unit_id ? unitsMap.get(p.unit_id) || '-' : '-',
      })) as ProfileWithRoles[];
    },
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      role: UserRole;
      app_roles: AppRole[];
      unit_id: string | null;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: data,
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Utilisateur invité avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      resetInviteDialog();
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { id: string; full_name: string; unit_id: string | null; is_active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          unit_id: data.unit_id,
          is_active: data.is_active,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Update roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async (data: { userId: string; newRoles: AppRole[] }) => {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', data.userId);
      if (deleteError) throw deleteError;

      // Insert new roles
      if (data.newRoles.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(data.newRoles.map((role) => ({ user_id: data.userId, role })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast.success('Rôles mis à jour');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowRolesDialog(false);
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.is_active ? 'Compte réactivé' : 'Compte désactivé');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error('Erreur', { description: error.message });
    },
  });

  const resetInviteDialog = () => {
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteFullName('');
    setInviteRole('supervisor');
    setInviteUnitId('none');
    setInviteAppRoles([]);
  };

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      toast.error('Email et nom complet requis');
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail,
      full_name: inviteFullName,
      role: inviteRole,
      app_roles: inviteAppRoles,
      unit_id: inviteUnitId === 'none' ? null : inviteUnitId,
    });
  };

  const openEditDialog = (user: ProfileWithRoles) => {
    setSelectedUser(user);
    setEditFullName(user.full_name);
    setEditUnitId(user.unit_id || 'none');
    setEditIsActive(user.is_active ?? true);
    setShowEditDialog(true);
  };

  const openRolesDialog = (user: ProfileWithRoles) => {
    setSelectedUser(user);
    setEditRoles([...user.roles]);
    setShowRolesDialog(true);
  };

  const toggleAppRole = (role: AppRole, checked: boolean) => {
    if (checked) {
      setEditRoles((prev) => [...prev, role]);
    } else {
      setEditRoles((prev) => prev.filter((r) => r !== role));
    }
  };

  const toggleInviteRole = (role: AppRole, checked: boolean) => {
    if (checked) {
      setInviteAppRoles((prev) => [...prev, role]);
    } else {
      setInviteAppRoles((prev) => prev.filter((r) => r !== role));
    }
  };

  const getRoleBadgeClass = (role: AppRole) => {
    return APP_ROLES.find((r) => r.value === role)?.color || '';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <CardDescription>Gérez les profils et les accès des utilisateurs</CardDescription>
            </div>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Inviter un utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !users?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Accès</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.role === 'manager' ? 'Manager' : 'Superviseur'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} variant="outline" className={getRoleBadgeClass(role)}>
                                {APP_ROLES.find((r) => r.value === role)?.label || role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.unit_name}</TableCell>
                      <TableCell>
                        <Switch
                          checked={user.is_active ?? true}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: user.id, is_active: checked })
                          }
                          disabled={user.id === currentProfile?.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openRolesDialog(user)}>
                            <Shield className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouveau compte utilisateur avec un mot de passe temporaire
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite_email">Email *</Label>
              <Input
                id="invite_email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite_name">Nom complet *</Label>
              <Input
                id="invite_name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Nom Prénom"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervisor">Superviseur</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={inviteUnitId} onValueChange={setInviteUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune unité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune unité</SelectItem>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rôles d'accès</Label>
              <div className="space-y-2 rounded-md border p-3">
                {APP_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`invite-${role.value}`}
                      checked={inviteAppRoles.includes(role.value)}
                      onCheckedChange={(checked) => toggleInviteRole(role.value, !!checked)}
                    />
                    <label htmlFor={`invite-${role.value}`} className="text-sm cursor-pointer">
                      {role.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetInviteDialog}>
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={editUnitId} onValueChange={setEditUnitId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune unité</SelectItem>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              <Label>Compte actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!selectedUser) return;
                updateProfileMutation.mutate({
                  id: selectedUser.id,
                  full_name: editFullName,
                  unit_id: editUnitId === 'none' ? null : editUnitId,
                  is_active: editIsActive,
                });
              }}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles Dialog */}
      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gérer les rôles d'accès</DialogTitle>
            <DialogDescription>{selectedUser?.full_name} ({selectedUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {APP_ROLES.map((role) => (
              <div key={role.value} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                <Checkbox
                  id={`role-${role.value}`}
                  checked={editRoles.includes(role.value)}
                  onCheckedChange={(checked) => toggleAppRole(role.value, !!checked)}
                />
                <label htmlFor={`role-${role.value}`} className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">{role.label}</div>
                </label>
                <Badge variant="outline" className={role.color}>
                  {role.value}
                </Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRolesDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!selectedUser) return;
                updateRolesMutation.mutate({ userId: selectedUser.id, newRoles: editRoles });
              }}
              disabled={updateRolesMutation.isPending}
            >
              {updateRolesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
