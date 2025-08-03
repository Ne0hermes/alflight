# Module Alternates - Sélection Automatique Avancée

## Vue d'ensemble

Le module Alternates implémente une sélection automatique et intelligente des aérodromes de déroutement basée sur une approche géométrique avancée et un scoring multi-critères.

## Caractéristiques principales

### 1. Zone de recherche géométrique

- **Triangle équilatéral inscrit** : La zone principale est un triangle équilatéral dont le côté égale la distance orthodromique entre départ et arrivée
- **Tampons dynamiques** : Zones circulaires de 5-10 NM autour des points tournants critiques (virages > 30°)
- **Extension de 5 NM** : Les aérodromes jusqu'à 5 NM au-delà des bords sont inclus

### 2. Rayon de recherche dynamique

Le rayon est calculé en fonction du carburant résiduel utilisable :
- Carburant utilisable = FOB - réserves obligatoires
- Rayon = Autonomie × Vitesse × 0.8 (marge de sécurité)
- Limité entre 15 et 50 NM
- Par défaut : 25 NM si données indisponibles

### 3. Système de scoring multi-critères

| Critère | Poids | Description |
|---------|-------|-------------|
| Distance | 30% | Proximité à la route principale |
| Infrastructure | 25% | Longueur de piste vs besoins avion |
| Services | 20% | Fuel, ATC/AFIS, balisage nocturne |
| Météo | 15% | Visibilité, plafond, vent |
| Position | 10% | Position stratégique (milieu parcours, virages) |

### 4. Données fournies pour chaque alternate

- **Identification** : Nom, code OACI
- **Distance** : Distance à l'axe principal en NM
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
│   ├── geometryCalculations.js    # Calculs géométriques avancés
│   └── alternateFilters.js        # Filtrage des candidats
├── hooks/
│   ├── useAlternateSelection.js   # Hook principal
│   └── useAlternateScoring.js     # Logique de scoring
├── components/
│   ├── AlternateSelector.jsx      # Interface de sélection
│   ├── AlternateMap.jsx          # Visualisation carte
│   └── AlternateDetails.jsx      # Détails des alternates
└── AlternatesModule.jsx           # Module principal
```

### Algorithmes clés

#### Calcul du triangle équilatéral
```javascript
const routeDistance = calculateDistance(departure, arrival);
const height = routeDistance * Math.sqrt(3) / 2;
const midpoint = calculateMidpoint(departure, arrival);
const vertex1 = calculateDestination(midpoint, height, bearing + 90);
const vertex2 = calculateDestination(midpoint, height, bearing - 90);
```

#### Calcul du rayon dynamique
```javascript
const usableFuel = fuelRemaining - reserves.final - reserves.alternate;
const enduranceHours = usableFuel / aircraft.fuelConsumption;
const maxRadius = enduranceHours * aircraft.cruiseSpeedKt * 0.8;
return Math.max(15, Math.min(50, maxRadius));
```

## Intégration avec les autres modules

### Navigation
- Récupère les waypoints et points tournants
- Utilise la distance totale de vol
- Identifie les virages critiques (> 30°)

### Carburant
- Calcule le carburant résiduel disponible
- Détermine le rayon d'action dynamique
- Vérifie l'autonomie vers chaque alternate

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

```javascript
import { useAlternateSelection } from '@features/alternates';

function MyComponent() {
  const {
    searchZone,         // Zone de recherche calculée
    selectedAlternates, // Alternates sélectionnés
    dynamicParams,      // Paramètres dynamiques
    isReady            // Prêt à calculer
  } = useAlternateSelection();
  
  // Utiliser les données...
}
```

## Points d'amélioration futurs

1. **Analyse météo prédictive** : Intégrer les TAF pour prévoir l'évolution
2. **Calcul PET/PSR** : Points d'égale distance temporelle et de non-retour
3. **Facteurs économiques** : Coût du carburant, taxes d'atterrissage
4. **Historique** : Apprentissage des préférences utilisateur
5. **Export** : Génération de fiches alternates PDF

## Performance

- Calculs géométriques optimisés avec cache
- Chargement météo limité aux 10 premiers candidats
- Scoring parallélisé avec Promise.all
- Mise à jour différée pour éviter les recalculs

## Conformité réglementaire

Le module respecte les exigences :
- Distance piste × 1.43 (marge réglementaire)
- Réserves carburant selon type de vol
- Minima météo VFR/IFR configurables
- Points tournants critiques identifiés