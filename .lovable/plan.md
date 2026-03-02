

# Plan: Dernier sprint avant le freeze production

## Etat des lieux

Les phases 1-3 du plan precedent sont terminees. Voici ce qui reste a ameliorer.

---

## 1. Corriger l'acces admin dans Settings et Objectives (CRITIQUE)

**Probleme** : `Settings.tsx` (ligne 189, 272, 279, 360, 362, 368) et `Objectives.tsx` (ligne 74, 106, 357, 371) utilisent encore `isManager` (champ legacy `profiles.role`). Un utilisateur avec le role `app_role = 'admin_site'` mais `profiles.role = 'supervisor'` ne verra PAS les onglets admin dans les parametres.

**Correction** :
- `Settings.tsx` : remplacer `isManager` par `canManage` calcule via `hasRole('manager_unite') || hasRole('admin_site') || hasRole('super_admin')`
- `Objectives.tsx` : idem, remplacer `isManager` par `canManage`

---

## 2. Policies RLS encore basees sur le role legacy (IMPORTANT)

**Probleme** : Plusieurs tables ont des politiques RLS qui verifient `profiles.role = 'manager'` au lieu d'utiliser `is_manager_or_above()`. Les utilisateurs avec un `app_role` manager mais un `profiles.role = 'supervisor'` seront bloques en ecriture.

Tables concernees :
- `event_types` : policy "Managers can manage event types" utilise `profiles.role = 'manager'`
- `operators` : policies INSERT/UPDATE utilisent `profiles.role = 'manager'`
- `events` : policy UPDATE utilise `profiles.role = 'manager'`
- `positions` : policy ALL utilise `profiles.role = 'manager'`
- `units` : policies ALL utilisent `profiles.role = 'manager'`
- `lines` : policies ALL utilisent `profiles.role = 'manager'`
- `shifts` : policies ALL utilisent `profiles.role = 'manager'`

**Correction** : Migration SQL pour remplacer toutes ces policies par `is_manager_or_above(auth.uid())` a la place de l'ancien check sur `profiles.role`.

---

## 3. Confirmation de suppression partout (MOYEN)

**Probleme** : Plusieurs endroits suppriment en un seul clic sans confirmation :
- `Settings.tsx` : suppression de postes (ligne 336)
- `Objectives.tsx` : suppression d'objectifs (ligne 376)
- `ReferentialsTab.tsx` : suppression d'unites (ligne 315), lignes (ligne 370), equipes (ligne 429)

**Correction** : Ajouter un `AlertDialog` de confirmation avant chaque suppression avec le message "Cette action est irreversible. Voulez-vous continuer ?"

---

## 4. ErrorBoundary global (MOYEN)

**Probleme** : Si un composant plante, l'application affiche un ecran blanc sans recours.

**Correction** :
- Creer `src/components/ErrorBoundary.tsx` (composant React class)
- Wrapper les routes dans `App.tsx` avec ce composant
- Afficher un message convivial avec bouton "Recharger la page"

---

## 5. Operateurs : champ Unite en texte libre (MINEUR)

**Probleme** : Dans `Operators.tsx`, le champ "Unite" est un `Input` texte libre. Risque de fautes de frappe et d'incoherence avec la table `units`. Le ranking compare les unites par texte (`o.unit = m.unit_name`).

**Correction** : Remplacer l'`Input` par un `Select` chargeant les unites depuis la table `units`.

---

## 6. Parametre `Settings` visible pour les readonly (MINEUR)

**Probleme** : Le lien "Parametres" dans le menu du footer de la sidebar est accessible a tous, y compris les `readonly`. La page Settings montre l'onglet profil (modification du nom) ce qui peut etre acceptable, mais il faut s'assurer que les onglets admin ne sont pas visibles.

**Correction** : Verifier que `Settings.tsx` utilise bien `canManage` (point 1) et decider si le readonly doit voir son profil ou non.

---

## Resume et ordre d'execution

| Priorite | Tache | Fichiers concernes |
|----------|-------|--------------------|
| CRITIQUE | Migrer isManager vers canManage (appRoles) | Settings.tsx, Objectives.tsx |
| IMPORTANT | Migrer les policies RLS vers is_manager_or_above | Migration SQL (7 tables) |
| MOYEN | AlertDialog de confirmation suppression | Settings.tsx, Objectives.tsx, ReferentialsTab.tsx |
| MOYEN | ErrorBoundary global | Nouveau composant + App.tsx |
| MINEUR | Select unite dans Operators | Operators.tsx |

## Details techniques

### Migration SQL (point 2)

```text
Pour chaque table concernee :
1. DROP la policy existante qui utilise profiles.role = 'manager'
2. CREATE une nouvelle policy identique mais avec is_manager_or_above(auth.uid())
Tables : event_types, operators, events, positions, units, lines, shifts
```

### ErrorBoundary (point 4)

```text
Composant React class :
- state: { hasError: boolean, error: Error | null }
- componentDidCatch: log l'erreur
- render: si erreur, afficher Card avec message + bouton Recharger
- sinon: afficher children
```

