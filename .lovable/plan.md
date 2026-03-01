

# Plan: Gestion des Utilisateurs et Acces

## Contexte

Actuellement, il n'existe aucune interface pour gerer les utilisateurs. Les profils sont crees automatiquement a l'inscription mais personne ne peut :
- Voir la liste des utilisateurs
- Modifier le role, l'unite ou le statut actif d'un utilisateur
- Inviter de nouveaux utilisateurs
- Attribuer/retirer des roles d'acces (super_admin, admin_site, manager_unite, superviseur, readonly)

## Ce qui sera livre

### 1. Edge Function pour inviter des utilisateurs

Creer `supabase/functions/invite-user/index.ts` :
- Recoit email, full_name, role (legacy), app_roles[], unit_id
- Utilise le service role key pour appeler `supabase.auth.admin.createUser()`
- Cree automatiquement le profil (via trigger existant)
- Insere les app_roles dans `user_roles`
- Securise : verifie que l'appelant est manager ou super_admin

### 2. Migrations SQL

**Mettre a jour les RLS sur `profiles`** :
- Permettre aux managers de modifier les profils des autres utilisateurs (unit_id, is_active, full_name)

**Mettre a jour les RLS sur `user_roles`** :
- Permettre aux managers (is_manager_or_above) de gerer les roles, pas seulement super_admin

### 3. Nouvel onglet "Utilisateurs" dans Settings

Ajouter un onglet visible uniquement pour les managers, contenant :

**Tableau des utilisateurs** :
- Colonnes : Nom, Email, Role legacy, Roles d'acces, Unite, Actif, Actions
- Badge colore par role

**Bouton "Inviter un utilisateur"** :
- Dialog avec : email, nom complet, role (supervisor/manager), roles d'acces (multi-select), unite
- Appelle l'edge function invite-user

**Actions par utilisateur** :
- Modifier : dialog pour changer nom, unite, statut actif
- Gerer les roles : dialog pour ajouter/retirer des app_roles
- Desactiver/Reactiver le compte

### 4. Composant `UsersTab.tsx`

Nouveau composant `src/components/settings/UsersTab.tsx` :
- Fetch profiles + user_roles (join)
- Fetch units pour le select
- CRUD complet avec mutations react-query
- Gestion d'erreurs et toasts

## Details techniques

### Edge Function invite-user

```text
POST /invite-user
Body: { email, full_name, role, app_roles[], unit_id }
Auth: Bearer token (verifie manager/super_admin)
Response: { user_id, profile }
```

### Migrations RLS

```sql
-- Managers can update any profile
CREATE POLICY "Managers can update profiles"
ON profiles FOR UPDATE TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Managers can manage roles
CREATE POLICY "Managers can manage roles"
ON user_roles FOR ALL TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));
```

### Structure UI

```text
Settings
  |-- Mon profil
  |-- Utilisateurs  <-- NOUVEAU (manager only)
  |-- Postes
  |-- Referentiels
  |-- Affectations
```

### Tableau utilisateurs

| Nom | Email | Role | Acces | Unite | Actif | Actions |
|-----|-------|------|-------|-------|-------|---------|
| Administrateur | amoo@... | Manager | manager_unite | - | Oui | Modifier / Roles |

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `supabase/functions/invite-user/index.ts` | Creer |
| Migration SQL | RLS profiles + user_roles |
| `src/components/settings/UsersTab.tsx` | Creer |
| `src/pages/Settings.tsx` | Ajouter onglet Utilisateurs |

## Ordre d'execution

1. Migration SQL (RLS)
2. Edge function invite-user
3. Composant UsersTab
4. Integration dans Settings

