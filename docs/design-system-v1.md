# ALFlight — Design System v1

> Charte éditoriale cinematic aviation premium.
> Référence visuelle : [sr-seventy.one](https://sr-seventy.one/) (datasheet SR-71 Blackbird).
> Pilote : Cesar — validation 2026-05-22.

---

## 1. Esprit

- Esthétique **éditoriale institutionnelle EASA/DGAC** — sobre, lisible en cockpit jour comme nuit.
- Photo cinematic optionnelle en fond + texte sobre + datasheet 4 coins + labels mono ALL CAPS.
- **Un seul accent par écran** : orange aviation `#f26921`.
- Mode nuit par défaut. Mode jour pour environnement lumineux.

---

## 2. Couleurs

### Orange marque (accent unique)

```
███████████   #f26921   primary   accent unique
███████████   #FF7E36   bright    hover
███████████   #D85410   dim       active / pressed
░░░░░░░░░░░   rgba(242,105,33,0.16)   soft   focus ring / overlays
```

### Noirs (mode nuit)

```
███████████   #0A0A0A   deep      canvas (fond plein écran)
███████████   #141414   elevated  cards, surfaces
███████████   #1C1C1C   overlay   inputs, modals
███████████   #232323   surface   séparateurs, track progress
```

### Blancs

```
███████████   #FFFFFF   pure      parcimonieux (KPI critiques)
███████████   #F5F2EC   soft      texte par défaut en nuit
░░░░░░░░░░░   #C9C5BD   muted     texte secondaire
░░░░░░░░░░░   #8A867E   dim       tertiaire / placeholders
```

### Rouge — RÉSERVÉ NO-GO catastrophique

```
███████████   #C04534   critical      VFR impossible / masse dépassée
███████████   #8B2E22   criticalDim   hover critique
```

> **PAS de bordeaux** (`#93163C` retiré).
> **PAS de violet, bleu, vert, jaune.**
> Pour les statuts, utiliser orange + neutres avec icônes (✓ ! ×).

---

## 3. Polices

### Famille principale — Century Gothic

```css
font-family:
  'Century Gothic',
  'URW Gothic',
  'Questrial',
  'Jost',
  'Avant Garde',
  system-ui,
  sans-serif;
```

Utilisée **partout** : titres, body, labels.
Fallback web libre : `Questrial` chargé depuis Google Fonts.

### Famille monospace — JetBrains Mono

```css
font-family:
  'JetBrains Mono',
  'IBM Plex Mono',
  'Roboto Mono',
  'SF Mono',
  Menlo,
  Consolas,
  monospace;
```

Utilisée **uniquement** pour data technique :
- Coordonnées (LAT/LON)
- Codes ICAO (LFPG, LFST…)
- Immatriculations (F-GBYU)
- Valeurs numériques (35 L/H, 12 500 ft, +003° M)
- Labels eyebrow ALL CAPS

---

## 4. Échelle typographique

| Token       | Taille | Hauteur | Usage                            |
|-------------|--------|---------|----------------------------------|
| `hero`      | 96px   | 1.0     | SplashScreen, page d'accueil     |
| `display`   | 56px   | 1.05    | Titres principaux d'écran        |
| `h1`        | 40px   | 1.1     | Section majeure                  |
| `h2`        | 28px   | 1.2     | Section                          |
| `h3`        | 20px   | 1.3     | Sous-section / titre de card     |
| `body`      | 15px   | 1.55    | Texte courant                    |
| `small`     | 13px   | 1.5     | Notes secondaires                |
| `eyebrow`   | 11px   | 1.2     | Labels ALL CAPS mono             |
| `data`      | 15px   | 1.4     | Valeurs en monospace             |
| `dataLg`    | 28px   | 1.1     | Valeurs principales en monospace |

Letter-spacing :
- Titres → négatif (-0.02em pour display, -0.01em pour h2)
- Eyebrow → +0.20em
- ALL CAPS boutons → +0.08em
- Tagline cinematic → +0.30em

---

## 5. Espacements (échelle 4px)

| Token | Valeur | Usage typique             |
|-------|--------|---------------------------|
| `0`   | 0px    |                           |
| `1`   | 4px    | Gap interne icône / texte |
| `2`   | 8px    | Padding inputs            |
| `3`   | 12px   | Gap labels                |
| `4`   | 16px   | Padding boutons sm        |
| `5`   | 20px   | Padding cards sm          |
| `6`   | 24px   | Padding cards md          |
| `7`   | 32px   | Gap sections              |
| `8`   | 40px   | Padding cards lg          |
| `9`   | 48px   | Marges hero               |
| `10`  | 64px   | Marges page               |

---

## 6. Rayons (angles vifs privilégiés)

- `none` 0px
- `sm` 2px (défaut cartes, inputs, boutons)
- `md` 3px
- `lg` 4px
- `pill` 999px (badges très petits uniquement)

> Pas de rounded-xl, pas de pilules.

---

## 7. Primitives editorial

Toutes dans `src/shared/components/editorial/` et exportées via le barrel.

```jsx
import {
  EditorialHeading,
  EditorialButton,
  DatasheetCard,
  DataReadout,
  TechLabel,
  CockpitTextField,
  LoadingCockpit,
  NightModeAlert,
  StepDial,
} from '@shared/components/editorial';
```

---

### 7.1 EditorialHeading

Titre éditorial avec eyebrow optionnel.

```jsx
<EditorialHeading level={1} eyebrow="OPS · BRIEFING">
  Préparation du vol
</EditorialHeading>
```

```
┌─────────────────────────────────────────┐
│ OPS · BRIEFING                          │  ← eyebrow mono
│                                         │
│ Préparation du vol                      │  ← Century Gothic display
└─────────────────────────────────────────┘
```

Props :
- `level` (1 | 2 | 3) — taille (display, h1, h2)
- `eyebrow` — string ALL CAPS au-dessus
- `as` — élément HTML cible (h1/h2/h3…)

---

### 7.2 TechLabel

Label ALL CAPS mono petit.

```jsx
<TechLabel>Coords</TechLabel>
<TechLabel active>WPT actif</TechLabel>
```

```
COORDS         (couleur #8A867E)
WPT ACTIF      (couleur orange si active)
```

Props :
- `active` (bool) — passe en couleur accent
- `as` — défaut `span`

---

### 7.3 DataReadout

Valeur technique en monospace, avec unité optionnelle.

```jsx
<DataReadout value={35.4} unit="L/H" precision={1} />
<DataReadout value="F-GBYU" />
<DataReadout value={12500} unit="ft" />
<DataReadout value={245} unit="NM" size="lg" emphasis />
```

```
35.4 L/H
F-GBYU
12 500 ft
245 NM   (orange si emphasis, taille dataLg)
```

Props :
- `value` — nombre ou string
- `unit` — suffix optionnel ALL CAPS
- `precision` — décimales
- `align` — left | right
- `size` — sm | md | lg
- `emphasis` — couleur accent orange

---

### 7.4 DatasheetCard

Card 4 coins avec slot central. Image cinematic optionnelle.

```jsx
<DatasheetCard
  topLeft="LFPG · CDG"
  topRight="34°R"
  bottomLeft={<TechLabel>Distance</TechLabel>}
  bottomRight={<DataReadout value={245} unit="NM" />}
  interactive
  onClick={...}
>
  <EditorialHeading level={3}>Charles de Gaulle</EditorialHeading>
</DatasheetCard>
```

```
┌─ LFPG · CDG ─────────────────── 34°R ─┐
│                                        │
│       Charles de Gaulle                │
│                                        │
└─ DISTANCE ───────────────── 245 NM ───┘
```

Props :
- `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — slots ReactNode
- `children` — slot central
- `image` — URL background
- `interactive` — cursor pointer + hover

---

### 7.5 EditorialButton

```jsx
<EditorialButton variant="primary">Démarrer le briefing</EditorialButton>
<EditorialButton variant="ghost" size="sm">Annuler</EditorialButton>
<EditorialButton variant="critical">No-go</EditorialButton>
<EditorialButton variant="primary" loading>Chargement</EditorialButton>
<EditorialButton as="a" href="/docs">Documentation</EditorialButton>
```

Variantes :
- `primary` — fond orange, texte noir, ALL CAPS
- `ghost` — transparent + bordure ghost, texte ivoire
- `critical` — fond rouge `#C04534`, texte blanc

Tailles : `sm` | `md` | `lg`.

---

### 7.6 CockpitTextField

Input avec label ALL CAPS au-dessus + suffix unité.

```jsx
<CockpitTextField
  label="QNH"
  value={qnh}
  onChange={(e) => setQnh(e.target.value)}
  unit="hPa"
  type="number"
  placeholder="1013"
  helperText="Pression au niveau de la mer"
/>
```

```
QNH                                      (TechLabel actif au focus)
┌────────────────────────────┬─────────┐
│ 1013                       │   HPA   │
└────────────────────────────┴─────────┘
  Pression au niveau de la mer
```

Props :
- `label`, `value`, `onChange`, `placeholder`
- `unit` — suffix optionnel
- `error` — message d'erreur
- `helperText` — texte d'aide
- `type` — text | number

---

### 7.7 LoadingCockpit

```jsx
<LoadingCockpit size={40} />
<LoadingCockpit size={56} label="Chargement données SIA" />
```

```
    ◜◝
   ◟  ◞      (cercle orange ¼ tournant)
    ◞◜
  CHARGEMENT DONNÉES SIA
```

Props :
- `size` — diamètre (default 40)
- `label` — texte optionnel ALL CAPS

---

### 7.8 NightModeAlert

Alerte slide-in bas-droite.

```jsx
<NightModeAlert
  severity="warn"
  title="QNH non saisi"
  description="Veuillez renseigner le QNH avant le briefing."
  onClose={() => closeAlert()}
  actions={<EditorialButton size="sm">Compléter</EditorialButton>}
/>
```

```
┌─┬────────────────────────────────────┬┐
│!│  ATTENTION                         ││
│ │  QNH non saisi                     ││
│ │  Veuillez renseigner le QNH…       ││
│ │  [ COMPLÉTER ]                     ││
└─┴────────────────────────────────────┴┘
   ↑ bordure gauche 3px orange (warn)
```

Severities :
- `info` — bord soft ivoire
- `warn` — bord orange
- `critical` — bord rouge `#C04534`
- `success` — bord orange (signal positif sobre)

---

### 7.9 StepDial

Stepper horizontal compact.

```jsx
<StepDial
  steps={[
    { label: 'Avion' },
    { label: 'Route' },
    { label: 'Carburant' },
    { label: 'Briefing' }
  ]}
  currentIndex={1}
  onStepClick={(i) => goToStep(i)}
/>
```

```
   ✓ ──── 02 ──── ─ 03 ─── ─ 04
  AVION   ROUTE   CARB.    BRIEFING
          ▲
       (orange glow sur l'étape courante)
```

Props :
- `steps` — array `{ label, icon? }`
- `currentIndex` — index actif
- `onStepClick` — clic sur étape complétée

---

## 8. SplashScreen

Écran d'introduction cinematic plein écran.

```jsx
import { SplashScreen } from '@shared/components/SplashScreen';

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} minDuration={1800} />
      )}
      <MainApp />
    </>
  );
};
```

Composition :
- Fond `#0A0A0A` plein écran fixed (`z-index: splash`)
- 4 coins éditoriaux (40px inset, bordure 1px ghost)
- Logo `ALFLIGHT` Century Gothic 96px (clamp jusqu'à 56px sur mobile)
- Tagline `PERITA PER PREPARATEM` mono 12px letter-spacing 0.30em
- Barre 2px × 240px, fill orange `#f26921` animée 1.2s ease-out
- 4 messages de boot rotatifs (300ms chacun)

---

## 9. Règles d'usage IMPÉRATIVES

1. **Un seul orange par écran**. Si un bouton primary est visible, aucun autre élément ne doit utiliser `--accent-primary`. Sauf cas KPI critique signalé.
2. **Pas de glass morphism coloré**. Le `backdrop-filter: blur(12px)` peut s'appliquer sur une surface au-dessus d'une photo cinematic, **sans teinte colorée**.
3. **JetBrains Mono = data uniquement**. Pas de paragraphe en mono. Pas de bouton en mono.
4. **Letter-spacing négatif sur les titres**, positif sur les eyebrows et ALL CAPS.
5. **Rouge `#C04534` = NO-GO catastrophique uniquement** (météo VFR impossible, masse hors limites, alerte structurelle).
6. **Pas d'emojis dans la prod**.
7. **Mode jour** : `<html data-theme="day-cockpit">`. Toutes les variables CSS sont remappées automatiquement.

---

## 10. Fichiers de référence

| Fichier                                                              | Rôle                                  |
|----------------------------------------------------------------------|---------------------------------------|
| `src/shared/styles/designSystem.js`                                  | Tokens JS + thèmes + helpers          |
| `src/index.css`                                                      | Variables CSS root + Google Fonts     |
| `src/shared/components/editorial/`                                   | 9 primitives                          |
| `src/shared/components/editorial/index.js`                           | Barrel export                         |
| `src/shared/components/SplashScreen.jsx`                             | Splash cinematic                      |
| `docs/design-system-v1.md`                                           | Cette documentation                   |
