# Module Alternates - Sélection Automatique Avancée avec Système Dual

## Vue d'ensemble

Le module Alternates implémente une sélection automatique et intelligente des aérodromes de déroutement basée sur une approche géométrique avancée utilisant une zone en forme de pilule (capsule) et un scoring multi-critères. 

**Nouveauté :** Système dual avec médiatrice garantissant un aérodrome accessible depuis le départ ET un depuis l'arrivée.

## Caractéristiques principales

### 1. Zone de recherche géométrique

- **Zone pilule (capsule)** : Zone définie comme l'ensemble des points à distance ≤ h du segment [P0, P1], où h = (√3/2) × distance
- **Tampons dynamiques** : Zones circulaires de 5-10 NM autour des points tournants critiques (virages > 30°)
- **Géométrie** : La zone forme une capsule avec deux demi-cercles aux extrémités et deux segments parallèles

### 2. Système dual avec médiatrice

- **Division de la zone** : La médiatrice du segment [départ, arrivée] divise la zone en deux parties
- **Sélection côté départ** : Le meilleur aérodrome du côté départ est sélectionné pour les déroutements en début de vol
- **Sélection côté arrivée** : Le meilleur aérodrome du côté arrivée est sélectionné pour les déroutements en fin de vol
- **Garantie** : Aucun chemin de déroutement n'est plus long que la navigation initiale

### 3. Rayon de recherche dynamique

Le rayon est calculé en fonction du carburant résiduel utilisable :
- Carburant utilisable = FOB - réserves obligatoires
- Rayon = Autonomie × Vitesse × 0.8 (marge de sécurité)
- Limité entre 15 et 50 NM
- Par défaut : 25 NM si données indisponibles

### 4. Système de scoring multi-critères

| Critère | Poids | Description |
|---------|-------|-------------|
| Distance | 30% | Proximité à la route principale |
| Infrastructure | 25% | Longueur de piste vs besoins avion |
| Services | 20% | Fuel, ATC/AFIS, balisage nocturne |
| Météo | 15% | Visibilité, plafond, vent |
| Position | 10% | Position stratégique (milieu parcours, virages) |

### 5. Données fournies pour chaque alternate

- **Identification** : Nom, code OACI
- **Distance** : Distance à l'axe principal en NM
- **Distance spécifique** : Distance depuis le départ OU l'arrivée selon le côté
- **Type de sélection** : 'departure' ou 'arrival'
- **Infrastructure** : Longueur et caractéristiques de la piste principale
- **Services** : ATC/AFIS, carburant, balisage
- **Météo** : METAR/TAF si disponibles
- **Score** : Score global et détail par critère
- **Rang** : EXCELLENT (≥80%), GOOD (≥60%), ACCEPTABLE (≥40%), MARGINAL (<40%)

## Architecture technique

### Fichiers principaux

```
src/features/alternates/
├── utils/
│   ├── geometryCalculations.js    # Calculs géométriques avec médiatrice
│   └── alternateFilters.js        # Filtrage des candidats
├── hooks/
│   ├── useAlternateSelection.js   # Hook principal avec logique dual
│   ├── useAlternateScoring.js     # Logique de scoring
│   └── useAdvancedAlternateSelection.js # Hook avancé pour l'UI
├── components/
│   ├── AlternateSelector.jsx      # Interface de sélection dual
│   ├── AlternateMap.jsx          # Visualisation carte avec médiatrice
│   └── AlternateDetails.jsx      # Détails des alternates par côté
├── AlternatesModule.jsx           # Module principal
├── index.js                       # Exports du module
└── README.md                      # Cette documentation
```

### Algorithmes clés

#### Calcul de la médiatrice
```javascript
const calculatePerpendicular = (departure, arrival) => {
  const midpoint = calculateMidpoint(departure, arrival);
  const routeBearing = calculateBearing(departure, arrival);
  const perpBearing = (routeBearing + 90) % 360;
  // Créer deux points définissant la médiatrice
  return {
    midpoint,
    point1: calculateDestination(midpoint, distance * 2, perpBearing),
    point2: calculateDestination(midpoint, distance * 2, (perpBearing + 180) % 360)
  };
};
```

#### Classification des aérodromes
```javascript
const getSideOfPerpendicular = (point, departure, arrival) => {
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  return distToDeparture < distToArrival ? 'departure' : 'arrival';
};
```

#### Sélection dual
```javascript
// Séparer par côté
const departureSideAirports = scored.filter(apt => apt.side === 'departure');
const arrivalSideAirports = scored.filter(apt => apt.side === 'arrival');

// Sélectionner le meilleur de chaque côté
const selectedAlternates = [
  departureSideAirports[0], // Meilleur côté départ
  arrivalSideAirports[0]    // Meilleur côté arrivée
];
```

## Intégration avec les autres modules

### Navigation
- Récupère les waypoints et points tournants
- Utilise la distance totale de vol
- Identifie les virages critiques (> 30°)
- Calcule la médiatrice de la route

### Carburant
- Calcule le carburant résiduel disponible
- Détermine le rayon d'action dynamique
- Vérifie l'autonomie vers chaque alternate
- Considère les deux aérodromes sélectionnés

### Performance
- Vérifie la compatibilité piste/avion
- Applique les marges réglementaires (×1.43)
- Considère les conditions météo

### Météo
- Récupère METAR/TAF pour scoring
- Évalue visibilité, plafond, vent
- Pénalise les mauvaises conditions

### VAC
- Vérifie la disponibilité des cartes
- Permet le téléchargement direct
- Intègre les données extraites

## Utilisation

### Import et utilisation de base
```javascript
import { useAlternateSelection } from '@features/alternates';

function MyComponent() {
  const {
    searchZone,         // Zone de recherche avec médiatrice
    selectedAlternates, // 2 alternates (1 départ, 1 arrivée)
    dynamicParams,      // Paramètres dynamiques
    isReady            // Prêt à calculer
  } = useAlternateSelection();
  
  // Les alternates ont maintenant un champ 'selectionType'
  const departureAlternate = selectedAlternates.find(alt => alt.selectionType === 'departure');
  const arrivalAlternate = selectedAlternates.find(alt => alt.selectionType === 'arrival');
}
```

### Utilisation du module complet
```javascript
import AlternatesModule from '@features/alternates';

function FlightPlanningPage() {
  return (
    <div>
      <AlternatesModule />
    </div>
  );
}
```

### Accès aux détails avancés
```javascript
import { useAdvancedAlternateSelection } from '@features/alternates';

function DetailedView() {
  const {
    formattedAlternates,  // Alternates formatés pour l'affichage
    statistics,           // Statistiques de recherche
    refreshAlternates    // Fonction de rafraîchissement
  } = useAdvancedAlternateSelection();
  
  // Afficher les statistiques par côté
  console.log(`Côté départ: ${statistics.departureSideCount}`);
  console.log(`Côté arrivée: ${statistics.arrivalSideCount}`);
}
```

## Interface utilisateur

### Affichage principal
- Carte avec visualisation de la zone pilule et de la médiatrice
- Tableaux séparés pour les aérodromes côté départ et côté arrivée
- Code couleur : rouge pour le départ, vert pour l'arrivée
- Affichage des distances depuis le point de référence approprié

### Sélection manuelle
- Interface de sélection divisée en deux colonnes
- Limitation à un aérodrome par côté
- Possibilité de sélection automatique du meilleur de chaque côté

### Détails
- Cartes détaillées pour chaque aérodrome sélectionné
- Affichage du score détaillé avec barres de progression
- Recommandations basées sur l'analyse
- Intégration des NOTAMs et météo

## Avantages du système dual

1. **Sécurité accrue** : Garantit toujours un aérodrome accessible quelle que soit la position sur la route
2. **Optimisation carburant** : Évite les déroutements trop longs qui consommeraient plus que le vol initial
3. **Décision simplifiée** : Le pilote sait immédiatement quel aérodrome choisir selon sa position
4. **Couverture complète** : Toute la route est couverte par au moins un aérodrome
5. **Conformité réglementaire** : Respecte l'exigence d'avoir un déroutement accessible à tout moment

## Points d'amélioration futurs

1. **Sélection manuelle** : Permettre au pilote de forcer la sélection d'aérodromes spécifiques
2. **Zone de transition** : Définir une zone autour de la médiatrice où les deux aérodromes sont valides
3. **Calcul PET** : Intégrer le Point of Equal Time entre les deux aérodromes
4. **Optimisation multi-critères** : Pondération personnalisable des critères
5. **Historique** : Mémoriser les préférences du pilote
6. **Export briefing** : Générer une fiche avec les deux alternates et leurs caractéristiques

## Performance

- Calculs géométriques optimisés avec cache
- Classification en O(n) avec une seule passe
- Test de distance au segment en O(1)
- Chargement météo limité aux aérodromes sélectionnés
- Scoring parallélisé avec Promise.all

## Conformité réglementaire

Le module respecte les exigences :
- Zone de recherche en forme de pilule (capsule) avec rayon h = (√3/2) × distance de vol
- Distance piste × 1.43 (marge réglementaire)
- Réserves carburant selon type de vol
- Minima météo VFR/IFR configurables
- Points tournants critiques identifiés
- **NOUVEAU** : Garantie d'accessibilité depuis départ ET arrivée

## Exemples de calcul

Pour un vol de 100 NM :
- Rayon de la capsule : h = 100 × √3/2 ≈ 86.6 NM
- Aire totale : ≈ 17,320 NM² (rectangle) + 23,545 NM² (cercle) = 40,865 NM²
- Médiatrice au point milieu (50 NM de chaque extrémité)
- Sélection : 1 aérodrome dans chaque demi-zone
- Garantie : Aucun déroutement > 100 NM

## API du module

### Hooks exportés
- `useAlternateSelection()` : Hook principal pour la sélection
- `useAdvancedAlternateSelection()` : Hook avancé avec formatage
- `useAlternatesForNavigation()` : Intégration navigation
- `useAlternatesForFuel()` : Intégration carburant
- `useAlternatesForPerformance()` : Intégration performance
- `useAlternatesForVAC()` : Intégration cartes VAC

### Composants exportés
- `AlternatesModule` : Module complet (défaut)
- `AlternateDetails` : Composant de détails
- `AlternateMap` : Composant carte
- `AlternateSelector` : Composant de sélection

### Utilitaires exportés
- `calculateSearchZone()` : Calcul de la zone de recherche
- `isAirportInSearchZone()` : Test d'appartenance
- `scoreAlternates()` : Fonction de scoring
- Fonctions géométriques diverses