
# PharmaTrack Performance

## Vue d'ensemble
Application interne pour enregistrer les événements quotidiens des opérateurs (incidents GMP, comportements HSE, déviations, assiduité/flexibilité, polyvalence, productivité) et calculer un score annuel avec classement.

---

## Fonctionnalités principales

### 1. Authentification
- Page de connexion email/mot de passe en français
- Redirection automatique selon le rôle (Superviseur ou Manager)

### 2. Gestion des Opérateurs
- Liste des opérateurs avec recherche par matricule/nom
- Le Manager peut ajouter/modifier des opérateurs
- **Nouveau** : Gestion de la polyvalence (nombre de postes maîtrisés par opérateur)
- Champs : matricule, nom complet, unité, statut actif, liste des postes maîtrisés

### 3. Saisie d'Événements Quotidiens (Superviseur)
- Sélection de l'opérateur (recherche)
- Sélection du type d'événement avec affichage des points
- Inclut les événements de productivité (saisis manuellement)
- Date/heure, équipe (shift), ligne, description
- Les événements majeurs exigent une description obligatoire
- Soumission en statut "En attente"

### 4. Import CSV/Excel Mensuel (Manager)
- Interface d'import pour les données de pointage :
  - Retards (nombre ou minutes)
  - Heures supplémentaires
  - Weekends travaillés
- Support fichiers automatiques (export pointeuse) ou manuels
- Prévisualisation avant validation
- Détection des doublons
- Génération automatique des événements correspondants

### 5. Configuration de la Grille de Scoring (Manager)
- Interface pour créer/modifier/désactiver les types d'événements
- Champs : code, libellé, catégorie, points, actif
- Modification des valeurs de points à tout moment
- **Catégories** : GMP, HSE, Comportement, Flexibilité, Assiduité, Bonus, Polyvalence, Productivité

### 6. File de Validation (Manager uniquement)
- Liste des événements en attente de validation
- Approuver ou rejeter avec note de justification
- Filtres par date, opérateur, catégorie

### 7. Tableau de Bord
- Compteurs : événements en attente, approuvés, rejetés
- Top types d'événements
- Points par catégorie
- Graphiques de tendance

### 8. Classement Annuel
- Sélecteur d'année
- Tableau avec : rang, opérateur, points bruts, score/100, note/20, nombre de postes maîtrisés
- Règle : pas de classement si < 60 jours travaillés
- Export CSV (classement et événements approuvés)

---

## Types d'Événements Prédéfinis (Modifiables)

**Malus :**
| Type | Points |
|------|--------|
| Rature/doc mal rempli | -0.5 |
| Incident GMP mineur | -2 |
| Déviation mineure | -3 |
| Déviation majeure | -8 |
| HSE/comportement dangereux | -6 |
| Refus flexibilité | -2 |
| Retard de pointage | -0.5 |
| Productivité insuffisante | -1 |

**Bonus :**
| Type | Points |
|------|--------|
| Flexibilité (2ème shift) | +1 |
| Signalement proactif | +0.5 |
| Weekend travaillé | +1 |
| Heures supplémentaires | +0.5 |
| Bonne productivité | +1 |
| Polyvalence (par poste maîtrisé au-delà de 2) | +0.5 |

---

## Formule de Scoring
- **Points bruts** = Σ points des événements approuvés + bonus polyvalence
- **Score/100** = clamp(80 + points_bruts, 0, 100)
- **Note/20** = round(score100 / 5, 1)

*Règles anti-gaming :*
- Cap bonus/jour : max +1.5/jour
- Pas de cap sur les malus
- Minimum 60 jours travaillés pour figurer au classement

---

## Import CSV/Excel

**Format attendu :**
| Matricule | Mois | Retards | Heures_Sup | Weekends |
|-----------|------|---------|------------|----------|
| OP001 | 2024-01 | 3 | 12 | 2 |

**Processus :**
1. Upload du fichier
2. Prévisualisation et validation des colonnes
3. Détection des opérateurs par matricule
4. Génération automatique des événements (ex: 3 retards = 3 événements "Retard")
5. Les événements générés passent en statut "APPROUVÉ" automatiquement (source système)

---

## Rôles et Permissions
| Action | Superviseur | Manager |
|--------|-------------|---------|
| Voir opérateurs | ✅ | ✅ |
| Ajouter/modifier opérateurs | ❌ | ✅ |
| Gérer polyvalence opérateurs | ❌ | ✅ |
| Créer événements manuels | ✅ | ✅ |
| Valider/rejeter événements | ❌ | ✅ |
| Importer CSV/Excel | ❌ | ✅ |
| Modifier grille de scoring | ❌ | ✅ |
| Voir tableau de bord | ✅ | ✅ |
| Export CSV | ✅ | ✅ |

---

## Design
- Interface responsive (mobile-friendly)
- Thème professionnel avec couleurs pharmaceutiques (bleu/vert)
- Navigation claire par sidebar
- Toutes les interfaces en français
