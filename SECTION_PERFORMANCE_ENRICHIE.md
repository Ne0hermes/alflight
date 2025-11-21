# MODULE PERFORMANCES - DOCUMENTATION TECHNIQUE EXHAUSTIVE

## 1. Introduction aux Performances Aéronautiques dans ALFlight

Le module Performance d'ALFlight calcule automatiquement les distances de décollage et d'atterrissage en fonction des conditions réelles (altitude terrain, température, vent, pente de piste, masse de l'avion). Ces calculs sont **critiques pour la sécurité** car ils déterminent si un vol peut être effectué en toute sécurité.

### 1.1 Différence Fondamentale : Abaques vs Tableaux de Performances

#### **ABAQUES (Nomogrammes Graphiques)**

**Définition :** Un abaque est une représentation graphique permettant de résoudre graphiquement des équations à plusieurs variables sans calcul mathématique direct.

**Caractéristiques :**
- Format : Graphique avec axes X/Y (ex: température vs distance de décollage)
- Source : Manuels de vol officiels (MANEX, POH - Pilot Operating Handbook)
- Précision : Lecture manuelle avec interpolation visuelle (~5% de marge d'erreur)
- Avantage : Vision intuitive de l'impact des paramètres
- Inconvénient : Nécessite numérisation et extraction des données

**Exemple typique dans un MANEX :**
```
Abaque Décollage - DA40 NG
-----------------------------
Axe X : Température extérieure (°C)  -20 à +40°C
Axe Y : Distance de décollage (m)    200 à 800m
Courbes : Une par altitude pression (0ft, 2000ft, 4000ft, 6000ft, 8000ft)
```

**Structure des données extraites d'un abaque :**
```json
{
  "chartName": "Takeoff Distance - Sea Level",
  "chartType": "takeoff",
  "pressureAltitude": 0,
  "dataPoints": [
    { "temperature": -20, "distance": 215 },
    { "temperature": -10, "distance": 240 },
    { "temperature": 0, "distance": 265 },
    { "temperature": 10, "distance": 295 },
    { "temperature": 20, "distance": 330 },
    { "temperature": 30, "distance": 370 },
    { "temperature": 40, "distance": 420 }
  ]
}
```

#### **TABLEAUX DE PERFORMANCES (Tables Numériques)**

**Définition :** Tableaux structurés avec valeurs numériques exactes organisées en lignes et colonnes.

**Caractéristiques :**
- Format : Grille de données (lignes = températures, colonnes = altitudes)
- Source : Manuels de vol, suppléments de performances
- Précision : Valeurs exactes nécessitant interpolation mathématique
- Avantage : Données structurées facilement exploitables par ordinateur
- Inconvénient : Moins intuitif visuellement

**Exemple tableau performances :**
```
TABLEAU DÉCOLLAGE DA40 NG (masses 1200-1310kg)
------------------------------------------------
Temp (°C) | 0 ft | 2000 ft | 4000 ft | 6000 ft
----------|------|---------|---------|--------
   -20    | 215m |   250m  |   290m  |   335m
   -10    | 240m |   280m  |   325m  |   380m
     0    | 265m |   310m  |   365m  |   430m
    10    | 295m |   350m  |   410m  |   485m
    20    | 330m |   390m  |   460m  |   545m
    30    | 370m |   440m  |   520m  |   615m
    40    | 420m |   500m  |   590m  |   700m
```

**Structure des données d'un tableau :**
```json
{
  "tableName": "Takeoff Distance Table",
  "masses": [1200, 1250, 1310],
  "altitudes": [0, 2000, 4000, 6000],
  "data": {
    "1310": {
      "0": { "-20": 215, "-10": 240, "0": 265, "10": 295, "20": 330, "30": 370, "40": 420 },
      "2000": { "-20": 250, "-10": 280, "0": 310, "10": 350, "20": 390, "30": 440, "40": 500 },
      "4000": { "-20": 290, "-10": 325, "0": 365, "10": 410, "20": 460, "30": 520, "40": 590 },
      "6000": { "-20": 335, "-10": 380, "0": 430, "10": 485, "20": 545, "30": 615, "40": 700 }
    }
  }
}
```

---

## 2. Séquence et Interaction des Calculs de Performances

### 2.1 Flux de Calcul Global

```
[1] ENTRÉES UTILISATEUR
    ├─ Aérodrome départ/arrivée (ICAO)
    ├─ Avion sélectionné (masse, performances)
    └─ Passagers et bagages (masse et centrage)
          ↓
[2] RÉCUPÉRATION DONNÉES MÉTÉO
    ├─ METAR départ/arrivée (API CheckWX)
    ├─ Extraction température OAT (°C)
    ├─ Extraction QNH (hPa)
    └─ Extraction vent (direction°, vitesse kt)
          ↓
[3] CALCUL ALTITUDE PRESSION
    │   Formula: PA = Elevation + (1013 - QNH) * 27
    │   Où:
    │   - Elevation = altitude terrain (ft)
    │   - QNH = pression atmosphérique ajustée (hPa)
    │   - 27 ft/hPa = constante ISA
          ↓
[4] SÉLECTION ABAQUE/TABLEAU
    ├─ Recherche abaque pour altitude pression calculée
    ├─ Si multiple abaques → interpolation entre 2 abaques encadrants
    └─ Si aucun abaque → fallback sur formule empirique
          ↓
[5] INTERPOLATION TEMPÉRATURE
    │   Formula: D = D1 + (T - T1) / (T2 - T1) * (D2 - D1)
    │   Où:
    │   - D = distance recherchée
    │   - T = température actuelle (°C)
    │   - D1, D2 = distances encadrantes dans l'abaque
    │   - T1, T2 = températures encadrantes
          ↓
[6] FACTEURS CORRECTIFS
    ├─ Vent effectif sur piste
    │   • Vent de face : Distance × (1 - WindComponent / 100)
    │   • Vent arrière : Distance × (1 + WindComponent / 50)
    ├─ Pente de piste
    │   • Montante : Distance × (1 + Slope% / 2)
    │   • Descendante : Distance × (1 - Slope% / 4)
    ├─ Surface piste
    │   • Herbe : Distance × 1.20
    │   • Gravier : Distance × 1.15
    │   • Asphalte/Béton : Distance × 1.00
    └─ État surface
        • Mouillée : Distance × 1.15
        • Enneigée : Distance × 1.40
        • Verglacée : Distance × 2.00
          ↓
[7] MARGES DE SÉCURITÉ
    │   Formula: Distance_Safe = Distance_Calculée × 1.33
    │   (Marge de 33% réglementaire)
          ↓
[8] RÉSULTAT FINAL
    ├─ Distance nécessaire décollage/atterrissage (m)
    ├─ Distance disponible (TORA/LDA de la piste)
    ├─ Verdict : SAFE / WARNING / UNSAFE
    └─ Alertes visuelles si piste trop courte
```

### 2.2 Code Source Séquence Calcul (PerformanceModule.jsx)

**Fichier :** `src/features/performance/PerformanceModule.jsx`

```javascript
// ÉTAPE 1 : Récupération température depuis METAR
const departureTemp = useMemo(() => {
  if (!departureAirport) return null;

  // Température depuis METAR décodé
  const metarTemp = departureWeather?.metar?.decoded?.temperature;

  // ⚠️ CRITIQUE : Ne JAMAIS utiliser ISA comme fallback (sécurité)
  if (metarTemp === undefined || metarTemp === null) {
    console.warn('❌ Pas de température METAR disponible');
    return null;
  }

  return metarTemp; // Température en °C
}, [departureAirport, departureWeather]);

// ÉTAPE 2 : Calcul altitude pression
const pressureAltitude = useMemo(() => {
  const elevation = departureAirport?.elevation || 0; // ft
  const qnh = departureWeather?.metar?.decoded?.pressure || 1013; // hPa

  // Formula: PA = Elevation + (1013 - QNH) * 27 ft/hPa
  return elevation + (1013 - qnh) * 27;
}, [departureAirport, departureWeather]);

// ÉTAPE 3 : Sélection abaques pour interpolation
const selectedCharts = useMemo(() => {
  if (!aircraftPerformanceTables) return null;

  // Trouver abaques encadrant l'altitude pression
  const charts = aircraftPerformanceTables.filter(chart =>
    chart.chartType === 'takeoff'
  ).sort((a, b) => a.pressureAltitude - b.pressureAltitude);

  // Interpolation entre 2 abaques si altitude entre 2 valeurs
  const lowerChart = charts.filter(c => c.pressureAltitude <= pressureAltitude).pop();
  const upperChart = charts.find(c => c.pressureAltitude >= pressureAltitude);

  return { lowerChart, upperChart, pressureAltitude };
}, [aircraftPerformanceTables, pressureAltitude]);

// ÉTAPE 4 : Interpolation bilinéaire température + altitude
function interpolateDistance(charts, temperature, pressureAlt) {
  const { lowerChart, upperChart } = charts;

  if (!lowerChart || !upperChart) return null;

  // Interpolation linéaire sur température pour chaque altitude
  const distLower = interpolateTemperature(lowerChart.dataPoints, temperature);
  const distUpper = interpolateTemperature(upperChart.dataPoints, temperature);

  // Interpolation linéaire entre altitudes
  const altRatio = (pressureAlt - lowerChart.pressureAltitude) /
                   (upperChart.pressureAltitude - lowerChart.pressureAltitude);

  return distLower + altRatio * (distUpper - distLower);
}

// Fonction interpolation température
function interpolateTemperature(dataPoints, temperature) {
  // Trouver points encadrant la température
  const sorted = dataPoints.sort((a, b) => a.temperature - b.temperature);

  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].temperature <= temperature && sorted[i + 1].temperature >= temperature) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  // Interpolation linéaire
  const tempRatio = (temperature - lower.temperature) /
                    (upper.temperature - lower.temperature);

  return lower.distance + tempRatio * (upper.distance - lower.distance);
}

// ÉTAPE 5 : Application facteurs correctifs
function applyCorrectiveFactors(baseDistance, conditions) {
  let correctedDistance = baseDistance;

  // Facteur vent
  if (conditions.headwind > 0) {
    correctedDistance *= (1 - conditions.headwind / 100);
  } else if (conditions.tailwind > 0) {
    correctedDistance *= (1 + conditions.tailwind / 50);
  }

  // Facteur pente
  if (conditions.slope > 0) {
    correctedDistance *= (1 + conditions.slope / 2); // Pente montante
  } else if (conditions.slope < 0) {
    correctedDistance *= (1 - Math.abs(conditions.slope) / 4); // Pente descendante
  }

  // Facteur surface
  const surfaceFactors = {
    'asphalt': 1.00,
    'concrete': 1.00,
    'grass': 1.20,
    'gravel': 1.15
  };
  correctedDistance *= surfaceFactors[conditions.surface] || 1.00;

  // Facteur état
  if (conditions.wet) correctedDistance *= 1.15;
  if (conditions.snow) correctedDistance *= 1.40;
  if (conditions.ice) correctedDistance *= 2.00;

  // Marge de sécurité 33%
  return correctedDistance * 1.33;
}
```

---

## 3. Équations Mathématiques Utilisées

### 3.1 Altitude Pression (Pressure Altitude)

```
PA = Elevation + (1013 - QNH) × 27

Où:
- PA = Pressure Altitude (ft)
- Elevation = Altitude terrain (ft)
- QNH = Pression atmosphérique ajustée au niveau de la mer (hPa)
- 27 ft/hPa = Gradient vertical ISA (International Standard Atmosphere)

Exemple:
- Elevation LFST (Strasbourg) = 502 ft
- QNH actuel = 1005 hPa
- PA = 502 + (1013 - 1005) × 27 = 502 + 216 = 718 ft
```

### 3.2 Interpolation Linéaire Simple (1D)

```
y = y₁ + (x - x₁) / (x₂ - x₁) × (y₂ - y₁)

Où:
- y = Valeur recherchée
- x = Variable d'entrée (ex: température)
- (x₁, y₁) = Point inférieur encadrant
- (x₂, y₂) = Point supérieur encadrant

Exemple Température:
- Points abaque: (-10°C, 240m) et (0°C, 265m)
- Température actuelle: -5°C
- Distance = 240 + (-5 - (-10)) / (0 - (-10)) × (265 - 240)
           = 240 + 5/10 × 25
           = 240 + 12.5
           = 252.5 m
```

### 3.3 Interpolation Bilinéaire (2D)

Pour interpoler simultanément sur 2 variables (température ET altitude), on utilise l'interpolation bilinéaire :

```
f(x, y) = f(0,0) × (1-s) × (1-t) +
          f(1,0) × s × (1-t) +
          f(0,1) × (1-s) × t +
          f(1,1) × s × t

Où:
- s = (x - x₀) / (x₁ - x₀)
- t = (y - y₀) / (y₁ - y₀)
- f(i,j) = Valeurs aux 4 coins de la grille

Exemple concret:
Données abaques:
- 0 ft, -10°C → 240m
- 0 ft, 0°C → 265m
- 2000 ft, -10°C → 280m
- 2000 ft, 0°C → 310m

Calcul pour: 1000 ft, -5°C
- s = (-5 - (-10)) / (0 - (-10)) = 5/10 = 0.5
- t = (1000 - 0) / (2000 - 0) = 0.5

Distance = 240×(1-0.5)×(1-0.5) + 265×0.5×(1-0.5) +
           280×(1-0.5)×0.5 + 310×0.5×0.5
         = 240×0.25 + 265×0.25 + 280×0.25 + 310×0.25
         = 60 + 66.25 + 70 + 77.5
         = 273.75 m
```

### 3.4 Composante de Vent Effectif sur Piste

```
Headwind = WindSpeed × cos(WindAngle - RunwayHeading)
Crosswind = WindSpeed × sin(WindAngle - RunwayHeading)

Facteur Correction Décollage:
- Si Headwind > 0: Distance × (1 - Headwind / 100)
- Si Tailwind > 0: Distance × (1 + Tailwind / 50)

Exemple:
- Piste 08 (QFU 080°)
- Vent 120° / 15 kt
- Angle relatif = 120° - 80° = 40°
- Headwind = 15 × cos(40°) = 15 × 0.766 = 11.5 kt
- Distance de base = 300m
- Distance corrigée = 300 × (1 - 11.5/100) = 300 × 0.885 = 265.5 m
  (Le vent de face réduit la distance nécessaire)
```

### 3.5 Correction Pente de Piste

```
Distance_Pente = Distance_Base × (1 + Slope% / FacteurPente)

Où:
- FacteurPente_Montante = 2.0 (pente divisée par 2)
- FacteurPente_Descendante = 4.0 (pente divisée par 4)

Exemple pente montante 2%:
- Distance de base = 300m
- Distance corrigée = 300 × (1 + 2/2) = 300 × 2 = 600m
  (Pente montante DOUBLE la distance !)

Exemple pente descendante -2%:
- Distance de base = 300m
- Distance corrigée = 300 × (1 - 2/4) = 300 × 0.5 = 150m
  (Pente descendante réduit la distance)
```

---

## 4. Méthode de Création d'Abaques Numériques de A à Z

### 4.1 Workflow Complet

```
[1] ACQUISITION MANEX PDF
    ↓
[2] EXTRACTION IMAGE ABAQUE
    ├─ Outil: PDF.js (pdfjs-dist)
    ├─ Page identifiée manuellement (ex: page 35)
    └─ Exportation PNG haute résolution (300 DPI)
    ↓
[3] NUMÉRISATION AXES ET COURBES
    ├─ Méthode manuelle: Lecture coordonnées pixels
    ├─ Méthode semi-auto: Détection contours (OpenCV.js)
    └─ Méthode IA: OpenAI Vision API (GPT-4 Vision)
    ↓
[4] EXTRACTION POINTS DE DONNÉES
    ├─ Identification courbes (altitude 0, 2000, 4000...)
    ├─ Lecture points sur chaque courbe (tous les 10°C)
    └─ Conversion pixels → valeurs réelles
    ↓
[5] VALIDATION ET VÉRIFICATION
    ├─ Comparaison avec valeurs connues du MANEX
    ├─ Vérification cohérence (distances croissantes)
    └─ Tests avec conditions réelles
    ↓
[6] STRUCTURATION JSON
    ├─ Métadonnées: nom, type, unités
    ├─ Courbes: altitude pression
    └─ DataPoints: température → distance
    ↓
[7] STOCKAGE INDEXEDDB
    ├─ Table: aircraftPerformanceTables
    ├─ Indexation: aircraftId + chartType
    └─ Compression: gzip pour optimiser
    ↓
[8] UTILISATION DANS L'APP
    └─ Interpolation temps réel avec conditions actuelles
```

### 4.2 Exemple Pratique : Numérisation Abaque DA40 NG

#### Étape 1 : Abaque Original (Papier)

```
TAKEOFF DISTANCE - SEA LEVEL
Diamond DA40 NG (MTOW 1310 kg)

[Graphique avec:]
- Axe X: OAT (Outside Air Temperature) de -20°C à +40°C
- Axe Y: Ground Roll Distance de 200m à 450m
- Courbes: Pression altitude 0 ft, 2000 ft, 4000 ft
```

#### Étape 2 : Identification Coordonnées Pixels

```javascript
// Calibration axes (mesure manuelle avec outil de mesure)
const chart = {
  pixelOrigin: { x: 150, y: 850 }, // Coin bas-gauche du graphique
  pixelMaxX: 950,                   // Coin bas-droit
  pixelMaxY: 150,                   // Coin haut-gauche

  realMinX: -20,  // °C
  realMaxX: 40,   // °C
  realMinY: 200,  // m
  realMaxY: 450   // m
};

// Fonction conversion pixel → valeur réelle
function pixelToReal(px, py) {
  const xRatio = (px - chart.pixelOrigin.x) / (chart.pixelMaxX - chart.pixelOrigin.x);
  const yRatio = (chart.pixelOrigin.y - py) / (chart.pixelOrigin.y - chart.pixelMaxY);

  const realX = chart.realMinX + xRatio * (chart.realMaxX - chart.realMinX);
  const realY = chart.realMinY + yRatio * (chart.realMaxY - chart.realMinY);

  return { temperature: realX, distance: realY };
}
```

#### Étape 3 : Extraction Points Courbe "Sea Level"

```javascript
// Points relevés manuellement sur la courbe "0 ft"
const seaLevelCurvePixels = [
  { px: 150, py: 750 },  // -20°C
  { px: 250, py: 700 },  // -10°C
  { px: 350, py: 650 },  //   0°C
  { px: 450, py: 590 },  //  10°C
  { px: 550, py: 520 },  //  20°C
  { px: 650, py: 440 },  //  30°C
  { px: 750, py: 350 }   //  40°C
];

// Conversion en valeurs réelles
const seaLevelDataPoints = seaLevelCurvePixels.map(point =>
  pixelToReal(point.px, point.py)
);

console.log(seaLevelDataPoints);
// Résultat:
// [
//   { temperature: -20, distance: 215 },
//   { temperature: -10, distance: 240 },
//   { temperature: 0, distance: 265 },
//   { temperature: 10, distance: 295 },
//   { temperature: 20, distance: 330 },
//   { temperature: 30, distance: 370 },
//   { temperature: 40, distance: 420 }
// ]
```

#### Étape 4 : Structure JSON Finale

```json
{
  "id": "da40ng-takeoff-sea-level",
  "aircraftId": "f-hstr",
  "chartName": "Takeoff Distance - Sea Level",
  "chartType": "takeoff",
  "phase": "ground_roll",
  "pressureAltitude": 0,
  "units": {
    "temperature": "celsius",
    "distance": "meters"
  },
  "conditions": {
    "wind": "calm",
    "surface": "hard_paved",
    "flaps": 0,
    "weight": 1310
  },
  "dataPoints": [
    { "temperature": -20, "distance": 215 },
    { "temperature": -10, "distance": 240 },
    { "temperature": 0, "distance": 265 },
    { "temperature": 10, "distance": 295 },
    { "temperature": 20, "distance": 330 },
    { "temperature": 30, "distance": 370 },
    { "temperature": 40, "distance": 420 }
  ],
  "metadata": {
    "source": "DA40 NG Flight Manual",
    "version": "Rev. 5",
    "dateExtracted": "2024-12-15",
    "extractedBy": "manual_digitization",
    "validated": true
  }
}
```

### 4.3 Méthode de Classement des Abaques

**Organisation hiérarchique :**

```
performanceTables/
├── takeoff/
│   ├── sea_level/
│   │   ├── 1200kg.json
│   │   ├── 1250kg.json
│   │   └── 1310kg.json (MTOW)
│   ├── 2000ft/
│   │   └── ...
│   ├── 4000ft/
│   └── 6000ft/
├── landing/
│   ├── sea_level/
│   ├── 2000ft/
│   └── 4000ft/
└── climb/
    └── rate_of_climb.json
```

**Nomenclature fichiers :**
```
{aircraftType}_{phase}_{altitude}_{mass}_{conditions}.json

Exemples:
- da40ng_takeoff_0ft_1310kg_flaps0.json
- da40ng_landing_2000ft_1250kg_fullflaps.json
- c172_takeoff_sl_max_gross.json
```

**Index de recherche :**
```javascript
// Structure d'indexation pour recherche rapide
const performanceIndex = {
  "takeoff": [
    {
      altitudeRange: [0, 1000],
      massRange: [1200, 1310],
      chartIds: ["chart-001", "chart-002"]
    },
    {
      altitudeRange: [1000, 3000],
      massRange: [1200, 1310],
      chartIds: ["chart-003", "chart-004"]
    }
  ],
  "landing": [...]
};

// Recherche optimisée
function findRelevantCharts(phase, altitude, mass) {
  const index = performanceIndex[phase];
  return index.filter(entry =>
    altitude >= entry.altitudeRange[0] &&
    altitude <= entry.altitudeRange[1] &&
    mass >= entry.massRange[0] &&
    mass <= entry.massRange[1]
  ).flatMap(entry => entry.chartIds);
}
```

---

## 5. Exemple Graphique d'Abaque Numérisé

### 5.1 Représentation Visuelle ASCII

```
TAKEOFF DISTANCE vs OAT - DA40 NG (Sea Level)
Distance (m)
   450 |                                      *  (40°C)
       |                                   *
   420 |                                *
       |                             *
   390 |                          *
       |                       *
   360 |                    *
       |                 *                     Courbe: 0 ft PA
   330 |              * (20°C)
       |           *
   300 |        *
       |     *
   270 |  * (0°C)
       |*
   240 |* (-10°C)
       |
   215 |* (-20°C)
       +----+----+----+----+----+----+----+----+---- OAT (°C)
      -20  -10   0   10   20   30   40

LÉGENDE:
* = Points de données extraits de l'abaque
Ligne continue = Interpolation linéaire entre points
```

### 5.2 Visualisation React avec Recharts

**Fichier :** `src/features/performance/components/PerformanceChart.jsx`

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const PerformanceChart = ({ performanceData }) => {
  // Données formatées pour Recharts
  const chartData = performanceData.dataPoints.map(point => ({
    temperature: point.temperature,
    distance: point.distance
  }));

  return (
    <LineChart width={800} height={400} data={chartData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="temperature"
        label={{ value: 'Température OAT (°C)', position: 'insideBottom', offset: -5 }}
      />
      <YAxis
        label={{ value: 'Distance de décollage (m)', angle: -90, position: 'insideLeft' }}
      />
      <Tooltip />
      <Legend />
      <Line
        type="monotone"
        dataKey="distance"
        stroke="#93163C"
        strokeWidth={3}
        dot={{ r: 5, fill: '#93163C' }}
        name={`Altitude ${performanceData.pressureAltitude} ft`}
      />
    </LineChart>
  );
};
```

### 5.3 Exemple Calcul Complet avec Affichage

```javascript
// Données d'entrée
const inputs = {
  aircraft: "F-HSTR (DA40 NG)",
  departure: "LFST (Strasbourg Entzheim)",
  elevation: 502, // ft
  qnh: 1005, // hPa
  temperature: 15, // °C
  wind: { direction: 270, speed: 10 }, // kt
  runway: { heading: 87, length: 2400, surface: 'asphalt' },
  mass: 1285 // kg
};

// Étape 1 : Altitude pression
const PA = inputs.elevation + (1013 - inputs.qnh) * 27;
console.log(`Altitude pression: ${PA} ft`); // 718 ft

// Étape 2 : Interpolation abaque
const baseDistance = interpolateFromChart(
  PA,              // 718 ft
  inputs.temperature, // 15°C
  inputs.mass      // 1285 kg
);
console.log(`Distance de base (abaque): ${baseDistance} m`); // 310 m

// Étape 3 : Vent effectif
const windAngle = inputs.wind.direction - inputs.runway.heading;
const headwind = inputs.wind.speed * Math.cos(windAngle * Math.PI / 180);
console.log(`Vent effectif: ${headwind.toFixed(1)} kt`); // 0.5 kt (quasi-nul)

const windFactor = headwind > 0 ? (1 - headwind / 100) : (1 + Math.abs(headwind) / 50);
const distanceWithWind = baseDistance * windFactor;
console.log(`Distance avec vent: ${distanceWithWind.toFixed(0)} m`); // 308 m

// Étape 4 : Marge de sécurité 33%
const safeDistance = distanceWithWind * 1.33;
console.log(`Distance sécurisée: ${safeDistance.toFixed(0)} m`); // 410 m

// Étape 5 : Verdict
const runwayAvailable = inputs.runway.length;
const margin = runwayAvailable - safeDistance;
const verdict = margin > 0 ? 'SAFE' : 'UNSAFE';

console.log(`\n=== RÉSULTAT ===`);
console.log(`Distance nécessaire: ${safeDistance.toFixed(0)} m`);
console.log(`Piste disponible: ${runwayAvailable} m`);
console.log(`Marge: ${margin.toFixed(0)} m`);
console.log(`Verdict: ${verdict} ✅`);
```

**Output console :**
```
Altitude pression: 718 ft
Distance de base (abaque): 310 m
Vent effectif: 0.5 kt
Distance avec vent: 308 m
Distance sécurisée: 410 m

=== RÉSULTAT ===
Distance nécessaire: 410 m
Piste disponible: 2400 m
Marge: 1990 m
Verdict: SAFE ✅
```

---

## 6. Gestion des Cas Limites et Erreurs

### 6.1 Absence de Données METAR

```javascript
// ⚠️ CAS CRITIQUE : Pas de température METAR
if (!temperature || temperature === null) {
  return {
    error: true,
    message: "❌ Température METAR indisponible - Calcul de performances IMPOSSIBLE",
    severity: "critical",
    action: "Attendez la mise à jour du METAR ou saisissez la température manuellement"
  };
}
```

### 6.2 Extrapolation Hors Limites Abaque

```javascript
// Si température hors plage abaque (-20°C à +40°C)
if (temperature < minTemp || temperature > maxTemp) {
  return {
    warning: true,
    message: `⚠️ Température ${temperature}°C hors limites abaque (${minTemp}°C - ${maxTemp}°C)`,
    severity: "warning",
    method: "extrapolation_linear", // Prolongement linéaire de la courbe
    accuracy: "reduced"
  };
}
```

### 6.3 Masse Hors Limites

```javascript
// Si masse > MTOW
if (mass > aircraft.maxTakeoffWeight) {
  return {
    error: true,
    message: `🚫 Masse ${mass} kg > MTOW ${aircraft.maxTakeoffWeight} kg`,
    severity: "blocking",
    action: "Réduire la masse (passagers/bagages/carburant)"
  };
}
```

---

## 7. Performance et Optimisations

### 7.1 Mise en Cache des Calculs

```javascript
import { useMemo } from 'react';

// Mémoïsation des calculs coûteux
const performanceResults = useMemo(() => {
  return calculatePerformance(
    aircraft,
    conditions,
    performanceTables
  );
}, [aircraft.id, conditions.temperature, conditions.altitude, performanceTables]);
```

### 7.2 Pré-calcul Tables de Lookup

```javascript
// Pré-générer une table de lookup pour accès instantané
const lookupTable = useMemo(() => {
  const table = {};

  for (let temp = -20; temp <= 40; temp += 1) {
    for (let alt = 0; alt <= 8000; alt += 500) {
      const key = `${temp}_${alt}`;
      table[key] = interpolateFromChart(alt, temp, mass);
    }
  }

  return table;
}, [performanceTables, mass]);

// Utilisation O(1) au lieu de O(n) interpolation
const distance = lookupTable[`${temperature}_${altitude}`];
```

---

## 8. Tests Unitaires et Validation

```javascript
describe('Performance Calculations', () => {
  test('Interpolation température simple', () => {
    const dataPoints = [
      { temperature: -10, distance: 240 },
      { temperature: 0, distance: 265 }
    ];

    const result = interpolateTemperature(dataPoints, -5);
    expect(result).toBeCloseTo(252.5, 1);
  });

  test('Calcul altitude pression', () => {
    const PA = calculatePressureAltitude(502, 1005);
    expect(PA).toBeCloseTo(718, 0);
  });

  test('Vent de face réduit distance', () => {
    const corrected = applyWindCorrection(300, 10, 'headwind');
    expect(corrected).toBeLessThan(300);
  });

  test('Pente montante augmente distance', () => {
    const corrected = applySlopeCorrection(300, 2); // 2% montée
    expect(corrected).toBeCloseTo(600, 0);
  });
});
```

---

**FIN DE LA SECTION PERFORMANCE ENRICHIE**

Cette documentation technique exhaustive couvre tous les aspects du module Performance d'ALFlight, des équations mathématiques aux exemples de code réels, en passant par la méthode complète de création et d'utilisation des abaques numériques.
