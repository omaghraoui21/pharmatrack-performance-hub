

# Plan: Production-Ready Freeze -- Application Maison

## Contexte

Application interne (maison) : pas d'inscription publique, pas de "mot de passe oublie". L'admin gere tout : creation/suppression de comptes, attribution des roles et mots de passe. Les utilisateurs recoivent leurs identifiants directement de l'admin.

---

## Phase 1 : Securite (P0 -- Critique)

### 1.1 Supprimer l'inscription publique

**Fichier**: `src/pages/Login.tsx`
- Supprimer l'onglet Tabs (Connexion/Inscription) et tout le formulaire d'inscription
- Garder uniquement le formulaire de connexion (email + mot de passe)
- Supprimer `signUp` de l'import `useAuth`
- Supprimer tout le state signup (signupEmail, signupPassword, signupName, signupRole)
- Mettre a jour le copyright : `2024` vers `new Date().getFullYear()`

**Fichier**: `src/contexts/AuthContext.tsx`
- Supprimer la methode `signUp` du contexte et de l'interface `AuthContextType`
- Garder `signIn` et `signOut` uniquement

### 1.2 Bloquer les comptes desactives

**Fichier**: `src/contexts/AuthContext.tsx`
- Apres le fetch du profil, verifier `is_active === false`
- Si inactif : appeler `signOut()` et afficher un toast "Votre compte est desactive"
- Empecher toute navigation

### 1.3 Admin peut definir le mot de passe a l'invitation

**Fichier**: `supabase/functions/invite-user/index.ts`
- Accepter un champ optionnel `password` dans le body
- Si fourni, utiliser ce mot de passe au lieu du UUID aleatoire
- L'admin communique le mot de passe a l'utilisateur en personne (application maison)

**Fichier**: `src/components/settings/UsersTab.tsx`
- Ajouter un champ "Mot de passe initial" dans le dialog d'invitation
- Validation : minimum 8 caracteres
- Le mot de passe est envoye a l'edge function

### 1.4 Admin peut reinitialiser le mot de passe d'un utilisateur

**Fichier**: `supabase/functions/invite-user/index.ts` (ou nouvelle edge function `reset-user-password`)
- Nouvelle route/action : recevoir `{ user_id, new_password }`
- Utiliser `adminClient.auth.admin.updateUserById(userId, { password })`
- Securise : verifier que l'appelant est manager_or_above

**Fichier**: `src/components/settings/UsersTab.tsx`
- Ajouter un bouton "Reinitialiser MDP" dans les actions de chaque utilisateur
- Dialog avec champ nouveau mot de passe
- Appel a l'edge function

### 1.5 Admin peut supprimer un utilisateur

**Fichier**: `supabase/functions/invite-user/index.ts` (ou nouvelle edge function `delete-user`)
- Nouvelle action DELETE : recevoir `{ user_id }`
- Utiliser `adminClient.auth.admin.deleteUser(userId)`
- Les cascades DB supprimeront le profil et les roles
- Securise : verifier que l'appelant est manager_or_above et ne se supprime pas lui-meme

**Fichier**: `src/components/settings/UsersTab.tsx`
- Ajouter un bouton "Supprimer" (avec confirmation AlertDialog) dans les actions
- Appel a l'edge function

---

## Phase 2 : Controle d'acces (P1)

### 2.1 Migrer ProtectedRoute vers app_roles

**Fichier**: `src/components/auth/ProtectedRoute.tsx`
- Remplacer `requireManager` par une prop `requiredRoles?: AppRole[]`
- Verifier via `hasRole()` ou `appRoles` au lieu de `isManager`
- Garder la retrocompatibilite : si `requiredRoles` absent, tout utilisateur authentifie passe

**Fichier**: `src/App.tsx`
- Remplacer `requireManager` par `requiredRoles={['manager_unite', 'admin_site', 'super_admin']}` sur les routes manager

### 2.2 Migrer la navigation vers app_roles

**Fichier**: `src/components/layout/AppSidebar.tsx`
- Changer le type de `roles` dans `navigationItems` : de `string[]` (supervisor/manager) vers `AppRole[]`
- Filtrer via `appRoles` depuis le contexte au lieu de `profile.role`
- Mapping :
  - `['supervisor', 'manager']` → `['superviseur', 'manager_unite', 'admin_site', 'super_admin']`
  - `['manager']` → `['manager_unite', 'admin_site', 'super_admin']`
  - Le role `readonly` voit uniquement Dashboard, Classement, Objectifs

### 2.3 Restrictions UI pour le role `readonly`

**Fichiers**: `NewEvent.tsx`, `Operators.tsx`, `Dashboard.tsx`
- Masquer les boutons de creation/modification pour les utilisateurs `readonly`
- Utiliser `hasRole('readonly')` depuis le contexte
- Le readonly peut voir les donnees mais pas agir

---

## Phase 3 : Qualite des donnees (P1)

### 3.1 Corriger l'import events -- dates distribuees

**Fichier**: `src/pages/Import.tsx`
- Au lieu de `event_date: row.mois + '-01'` pour tous les events, distribuer les dates :
  - Retard i → `mois-{i+1}` (jour 1, 2, 3...)
  - Heures sup i → `mois-{10+i}` (jour 10, 11, 12...)
  - Weekends i → les samedis du mois
- Ajouter `approved_at: new Date().toISOString()` sur chaque event importe

### 3.2 Shifts et Lines dynamiques dans NewEvent

**Fichier**: `src/pages/NewEvent.tsx`
- Remplacer les valeurs hardcodees ("Matin", "Apres-midi", "Nuit") par un fetch de la table `shifts`
- Remplacer le champ texte "Ligne" par un Select avec fetch de la table `lines`
- Utiliser les IDs (`shift_id`, `line_id`) au lieu des champs texte (`shift`, `line`)

---

## Phase 4 : Robustesse UX (P2)

### 4.1 ErrorBoundary global

**Fichier**: Creer `src/components/ErrorBoundary.tsx`
- Composant React class avec `componentDidCatch`
- Affiche un message d'erreur convivial avec bouton "Recharger"

**Fichier**: `src/App.tsx`
- Wrapper les routes avec ErrorBoundary

### 4.2 Confirmation de suppression partout

**Fichiers**: `Settings.tsx` (positions), `UsersTab.tsx`, `Objectives.tsx`
- Remplacer les suppressions directes par un AlertDialog de confirmation
- Message : "Cette action est irreversible. Voulez-vous continuer ?"

### 4.3 Liens SPA dans Dashboard

**Fichier**: `src/pages/Dashboard.tsx`
- Remplacer les 3 balises `<a href=...>` (lignes 252, 268, 284) par `<Link to=...>` de react-router-dom

### 4.4 QueryClient hors du composant

**Fichier**: `src/App.tsx`
- Deplacer `const queryClient = new QueryClient()` hors du composant App
- Ajouter `defaultOptions: { queries: { staleTime: 60_000 } }` pour eviter les re-fetch constants

---

## Resume des livrables

| Priorite | Tache | Fichiers |
|----------|-------|----------|
| P0 | Supprimer inscription publique | Login.tsx, AuthContext.tsx |
| P0 | Bloquer comptes desactives | AuthContext.tsx |
| P0 | Mot de passe a l'invitation | invite-user/index.ts, UsersTab.tsx |
| P0 | Reinitialisation MDP par admin | Nouvelle edge function, UsersTab.tsx |
| P0 | Suppression utilisateur par admin | Nouvelle edge function, UsersTab.tsx |
| P1 | Migrer ProtectedRoute vers app_roles | ProtectedRoute.tsx, App.tsx |
| P1 | Migrer navigation vers app_roles | AppSidebar.tsx |
| P1 | Restrictions readonly | NewEvent, Operators, Dashboard |
| P1 | Import events dates distribuees | Import.tsx |
| P1 | Shifts/Lines dynamiques | NewEvent.tsx |
| P2 | ErrorBoundary | Nouveau composant, App.tsx |
| P2 | Confirmation suppression | Settings, UsersTab, Objectives |
| P2 | Liens SPA Dashboard | Dashboard.tsx |
| P2 | QueryClient optimise | App.tsx |

## Ordre d'execution

1. P0 : Securite (inscription, comptes inactifs, MDP admin, suppression)
2. P1 : Controle d'acces (app_roles, readonly, import, shifts/lines)
3. P2 : Robustesse (ErrorBoundary, confirmations, liens, performance)

