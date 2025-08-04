# Module Alternates - Sélection Automatique Avancée

## Vue d'ensemble

Le module Alternates implémente une sélection automatique et intelligente des aérodromes de déroutement basée sur une approche géométrique avancée utilisant une zone en forme de pilule (capsule) et un scoring multi-critères.

## Caractéristiques principales

### 1. Zone de recherche géométrique

- **Zone pilule (capsule)** : Zone définie comme l'ensemble des points à distance ≤ h du segment [P0, P1], où h = (√3/2) × distance
- **Tampons dynamiques** : Zones circulaires de 5-10 NM autour des points tournants critiques (virages > 30°)
- **Géométrie** : La zone forme une capsule avec deux demi-cercles aux extrémités et deux segments parallèles

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

#### Calcul de la zone pilule (capsule)
```javascript
const routeDistance = calculateDistance(departure, arrival);
const height = routeDistance * Math.sqrt(3) / 2;
// Zone = ensemble des points à distance ≤ height du segment [departure, arrival]
// Génération de vertices pour visualisation :
// - Demi-cercle de rayon height au départ
// - Demi-cercle de rayon height à l'arrivée
// - Connexion des deux demi-cercles
```

#### Vérification d'appartenance à la zone
```javascript
const isInPillZone = (point, departure, arrival, radius) => {
  const distanceToRoute = calculateDistanceToSegment(point, departure, arrival);
  return distanceToRoute <= radius;
};
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

## Avantages de la zone pilule

1. **Couverture uniforme** : Largeur constante tout le long de la route
2. **Plus intuitive** : Tous les points à égale distance de la route ont la même priorité
3. **Calcul efficace** : Test simple de distance au segment
4. **Meilleure couverture** : Aire totale = 2h × d + πh² (plus grande que le triangle)
5. **Adaptée aux longs vols** : Maintient une zone de recherche cohérente

## Points d'amélioration futurs

1. **Analyse météo prédictive** : Intégrer les TAF pour prévoir l'évolution
2. **Calcul PET/PSR** : Points d'égale distance temporelle et de non-retour
3. **Facteurs économiques** : Coût du carburant, taxes d'atterrissage
4. **Historique** : Apprentissage des préférences utilisateur
5. **Export** : Génération de fiches alternates PDF
6. **Multi-zones** : Support de zones composites pour routes complexes

## Performance

- Calculs géométriques optimisés avec cache
- Test de distance au segment en O(1)
- Chargement météo limité aux 10 premiers candidats
- Scoring parallélisé avec Promise.all
- Mise à jour différée pour éviter les recalculs

## Conformité réglementaire

Le module respecte les exigences :
- Zone de recherche en forme de pilule (capsule) avec rayon h = (√3/2) × distance de vol
- Distance piste × 1.43 (marge réglementaire)
- Réserves carburant selon type de vol
- Minima météo VFR/IFR configurables
- Points tournants critiques identifiés

## Exemples de calcul

Pour un vol de 100 NM :
- Rayon de la capsule : h = 100 × √3/2 ≈ 86.6 NM
- Aire totale : ≈ 17,320 NM² (rectangle) + 23,545 NM² (cercle) = 40,865 NM²
- Zone de recherche très large garantissant de nombreux candidats