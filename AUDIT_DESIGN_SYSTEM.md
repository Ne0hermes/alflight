# 🔍 Audit d'intégrité UI/UX — ALFlight Design System
**Date :** 2026-06-03 · **Périmètre :** `alflight/src` (201 JSX + 208 JS, ~151 000 lignes) · **Stack :** React 18 + Vite + MUI v7 + Emotion

---

## 0. Synthèse exécutive (le verdict)

Le projet **possède déjà un Design System excellent et complet** (`src/index.css` + `src/shared/styles/designSystem.js`) : variable maître `--app-bg`, échelle de radius, système unifié de boutons/inputs, modes nuit/jour. **Le problème n'est pas l'absence de DS — c'est qu'il n'est pas la source de vérité unique.**

Trois pathologies se cumulent :

1. **Fragmentation des sources** — il existe **8 fichiers JS de tokens/thème concurrents** (dont 3 morts) + ~12 CSS, qui définissent les *mêmes* concepts avec des *valeurs différentes* (radius 8px vs 4px vs 2px ; police Century Gothic vs Space Grotesk ; breakpoint xl 1280 vs 1400).
2. **Hardcoding massif coexistant** — malgré 4 582 usages corrects de `var(--…)`, on dénombre **~900 couleurs hex, ~470 rgba(), ~1 957 `fontSize`, ~2 880 `padding`/`margin`, 757 `gap`** écrits en dur.
3. **Violations de charte** — palette « feu tricolore » (vert/rouge/ambre) et restes **bordeaux** de l'ancienne identité, jusque dans le composant racine `MobileApp.jsx` et le bouton partagé `shared/components/Button.jsx`.

| Catégorie | Déviations hardcodées | Usage correct DS |
|---|---:|---:|
| Couleurs hex `#xxx` | **901** (713 JSX + 188 JS) | `var(--…)` : **4 582** |
| `rgba()` / `rgb()` | **471** (342 JSX + 129 JS) | `tokens.*` : **388** |
| `fontSize` littéral | **1 957** | `theme.colors.*` : **238** |
| `fontFamily` littéral | **52** | |
| `fontWeight` numérique | **191** | |
| `padding` littéral | **1 332** | |
| `margin` littéral | **1 547** | |
| `gap` littéral | **757** | |
| `borderRadius` littéral | **79** | |
| **Styles inline `style={{}}`** | **3 783** | `sx={{}}` : 935 |
| `!important` (CSS) | **~470** | |

> **Cause racine structurelle :** 3 783 blocs `style={{}}` inline. Le style inline ne peut pas hériter de la cascade CSS ni des `:hover`/`:focus`, ce qui *pousse* mécaniquement les développeurs à recopier des valeurs en dur. C'est le vecteur n°1 du hardcoding.

---

## 1. Cartographie & analyse de l'existant

### 1.1 Méthode de gestion du design
- **CSS-in-JS via MUI + Emotion** (props `sx`) **et** styles inline React (`style={{}}`) **et** CSS global (`@import` dans `index.css`). Trois paradigmes coexistent.
- **Aucun Tailwind, aucun Sass, aucun CSS Module** (sauf un isolé : `abac/curves/ui/styles.module.css`).

### 1.2 Source de vérité *intentionnelle* (la bonne)
[`src/index.css`](src/index.css:45-203) est conçu comme la source unique et il est **remarquable** :
- `--app-bg` = variable maître ; tous les noirs en dérivent (`:53`).
- Échelle de radius canonique `--radius-sm/md/lg/pill` (`:130-134`).
- Système unifié boutons `--btn-padding-y/x`, `--btn-font-size`, `--btn-min-height` (`:145-150`).
- Système unifié inputs `--input-*` (`:169-202`).
- Mode jour via `[data-theme="day-cockpit"]` (`:233-257`).

[`src/shared/styles/designSystem.js`](src/shared/styles/designSystem.js) est le miroir JS propre (tokens `palette`, `typography`, `spacing` échelle 4px, `radius`, `motion`, `zIndex`) + helpers (`cx`, `pxToRem`, `mq`). **C'est la cible à généraliser.**

### 1.3 Les sources *concurrentes* (le problème) — qui est vivant ?

| Fichier | Rôle prétendu | Importateurs | Verdict |
|---|---|---:|---|
| `shared/styles/designSystem.js` | Tokens officiels v1 | **31** | ✅ **Cible** |
| `shared/styles/styleSystem.js` | Ancien `theme`/`sx` | **63** | ⚠️ Le plus utilisé, à migrer |
| `styles/theme.js` | Legacy remappé | **21** | ⚠️ Transitionnel |
| `styles/muiTheme.js` | Thème MUI actif | 1 (racine) | ⚠️ Double synchro manuelle |
| ~~`styles/tokens.js`~~ | « Tokens centralisés » | **0** (le « 1 » était un commentaire JSDoc) | 🗑️ **SUPPRIMÉ (Vague 3)** — mort + contradictoire |
| ~~`styles/unifiedDesignSystem.js`~~ (28 Ko, 68 hex) | « Unifié » | **0** | 🗑️ **SUPPRIMÉ (Vague 1)** |
| ~~`styles/premium-theme.js`~~ (18 hex) | Thème premium | **0** | 🗑️ **SUPPRIMÉ (Vague 1)** |
| ~~`styles/theme-loader.js`~~ | Loader | **0** | 🗑️ **SUPPRIMÉ (Vague 1)** |
| ~~`App.jsx`~~ (190 lignes) | Racine app ? | **0** | 🗑️ **SUPPRIMÉ (Vague 1)** (racine réelle = `MobileApp.jsx`) |

> **Bilan consolidation (vagues 1+3) :** on passe de **8 → 3** fichiers de tokens/thème. Survivants : `index.css` (master CSS) + `designSystem.js` (API JS) + `muiTheme.js` (pont MUI). Restent à migrer en shims puis supprimer : `styleSystem.js` (63), `theme.js` (21).

> [`styles/muiTheme.js`](src/styles/muiTheme.js:11-15) avoue lui-même la faille : *« MUI ne consomme pas les variables CSS… Si tu changes `--app-bg` dans index.css, change AUSSI ces valeurs ici. »* → **deux sources à synchroniser à la main = dérive garantie.**

### 1.4 Les règles globales sont-elles respectées ?
**Partiellement.** Le DS est massivement adopté (4 582 `var()`), mais en surcouche d'une base hardcodée jamais nettoyée. Les ~470 `!important` (153 dans `alflight-components.css`, 116 dans `unified-styles.css`, 106 dans `global-overrides.css`) prouvent une **guerre de spécificité** : les systèmes se neutralisent mutuellement à coups de `!important`.

---

## 2. Chasse au hardcoding — l'inventaire des déviations

### 2.1 🎨 Couleurs

**Pires fichiers (nombre de hex `#xxx`) :**

| Fichier | # hex | Composant impacté |
|---|---:|---|
| [`flight-wizard/components/FlightRecapTable.jsx`](src/features/flight-wizard/components/FlightRecapTable.jsx) | **111** | Tableau récap PDF |
| [`weight-balance/components/WeightBalanceChart.jsx`](src/features/weight-balance/components/WeightBalanceChart.jsx) | 36 | Graphe centrage |
| [`aircraft/components/wizard-steps/Step2Speeds.jsx`](src/features/aircraft/components/wizard-steps/Step2Speeds.jsx) | 29 | Wizard avion |
| [`abac/v2/BezierAbacEditor.jsx`](src/abac/v2/BezierAbacEditor.jsx) | 29 | Éditeur abaque |
| [`vac/components/SIAReportEnhanced.jsx`](src/features/vac/components/SIAReportEnhanced.jsx) | 25 | Rapport SIA |
| [`pilot/components/FlightCurrencyTracker.jsx`](src/features/pilot/components/FlightCurrencyTracker.jsx) | 24 | Suivi currency |
| [`aircraft/components/SpeedLimitationChart.jsx`](src/features/aircraft/components/SpeedLimitationChart.jsx) | 23 | Graphe vitesses |
| [`navigation/components/AirspaceFilters.jsx`](src/features/navigation/components/AirspaceFilters.jsx) | 20 | Filtres espaces |

**Déviations ciblées (fichier:ligne · valeur · note) :**

| Emplacement | Valeur hardcodée | Problème |
|---|---|---|
| [`FlightRecapTable.jsx:82`](src/features/flight-wizard/components/FlightRecapTable.jsx:82) | `'#10b981'` (vert) | Hors-charte |
| [`FlightRecapTable.jsx:83`](src/features/flight-wizard/components/FlightRecapTable.jsx:83) | `'#ef4444'` (rouge) | ≠ rouge charte `#C04534` |
| [`FlightRecapTable.jsx:84`](src/features/flight-wizard/components/FlightRecapTable.jsx:84) | `'#f59e0b'` (ambre) | Hors-charte |
| [`FlightRecapTable.jsx:315,471,653`](src/features/flight-wizard/components/FlightRecapTable.jsx:315) | `'#3b82f6'` (bleu) | Hors-charte |
| [`WeightBalanceChart.jsx:259,260,532`](src/features/weight-balance/components/WeightBalanceChart.jsx:259) | `'#3b82f6'`, `'#10b981'`, `'#dbeafe'` | Bleu+vert hors-charte |
| [`VACModule.jsx:997`](src/features/vac/VACModule.jsx:997) | `'#1976d2'` / `'#f57c00'` | Bleu MUI + orange non-token |
| [`CgEnvelopeChart.jsx:152,164`](src/features/aircraft/components/CgEnvelopeChart.jsx:152) | `'#22c55e'`, `'#dc2626'` | Vert + rouge hors-charte |
| [`MobileApp.jsx:356,362`](src/MobileApp.jsx:356) | `'#8b1538'`, `rgba(139,21,56,…)` | **Bordeaux dans la racine** |
| [`shared/components/Button.jsx:42,45,65`](src/shared/components/Button.jsx:42) | `rgba(147,22,60,…)` | **Bordeaux dans le bouton partagé** |
| [`styles/tokens.js:17,18`](src/styles/tokens.js:17) | `'#B91D4C'`, `'#5A0C22'` | Bordeaux dans un fichier de tokens |

### 2.2 ✍️ Typographie

**Pires fichiers (`fontSize` littéraux) :**

| Fichier | # `fontSize` | Composant |
|---|---:|---|
| [`vac/components/SIAReportEnhanced.jsx`](src/features/vac/components/SIAReportEnhanced.jsx) | **106** | Rapport SIA |
| [`flight-wizard/steps/Step7Summary.jsx`](src/features/flight-wizard/steps/Step7Summary.jsx) | **106** | Récap vol |
| [`aircraft/AircraftModule.jsx`](src/features/aircraft/AircraftModule.jsx) | **93** | Module avion (6 320 lignes) |
| [`aircraft/components/wizard-steps/Step5Equipment.jsx`](src/features/aircraft/components/wizard-steps/Step5Equipment.jsx) | 80 | Wizard étape 5 |
| [`pilot/components/PilotLogbook.jsx`](src/features/pilot/components/PilotLogbook.jsx) | 62 | Carnet de vol |

**Déviations ciblées :**

| Emplacement | Valeur hardcodée | Problème |
|---|---|---|
| [`FlightRecapTable.jsx:390`](src/features/flight-wizard/components/FlightRecapTable.jsx:390) | `fontSize: '8px'` | Sous le minimum lisible, hors échelle |
| [`styles/tokens.js:165`](src/styles/tokens.js:165) | `"'Space Grotesk', 'Inter'"` | **Mauvaise police** (charte = Century Gothic) |
| [`shared/components/Button.jsx:104,107,109`](src/shared/components/Button.jsx:104) | `fontSize: '14px'/'16px'/'15px'` | Devrait être `var(--btn-font-size)` |
| 191 occurrences | `fontWeight: 700/600/500` numérique | Devrait référencer `tokens.typography.*.fontWeight` |

### 2.3 📐 Disposition & espacement

**Pires fichiers (`padding`+`margin` littéraux cumulés) :**

| Fichier | # | Composant |
|---|---:|---|
| [`aircraft/AircraftModule.jsx`](src/features/aircraft/AircraftModule.jsx) | **190** | Module avion |
| [`vac/components/SIAReportEnhanced.jsx`](src/features/vac/components/SIAReportEnhanced.jsx) | **131** | Rapport SIA |
| [`flight-wizard/steps/Step7Summary.jsx`](src/features/flight-wizard/steps/Step7Summary.jsx) | **104** | Récap vol |
| [`navigation/components/VFRNavigationTable.jsx`](src/features/navigation/components/VFRNavigationTable.jsx) | 71 | Table navigation |
| [`regulations/components/RegulationsModule.jsx`](src/features/regulations/components/RegulationsModule.jsx) | 68 | Réglementation |

**Déviations ciblées :**

| Emplacement | Valeur hardcodée | Devrait être |
|---|---|---|
| [`shared/components/Button.jsx:104-109`](src/shared/components/Button.jsx:104) | `padding: '8px 16px'`, `'16px 32px'`, `'12px 24px'` | `var(--btn-padding-y/x)` |
| [`FlightRecapTable.jsx:390`](src/features/flight-wizard/components/FlightRecapTable.jsx:390) | `marginBottom: '2px'` | `tokens.spacing[…]` |
| ~~**Radius divergents**~~ | ✅ **RÉSOLU (Vague 3)** — la seule vraie divergence était `tokens.js sm:4` (fichier mort, supprimé). `muiTheme.js borderRadius:2` n'en est **PAS une** : c'est le *multiplicateur* de base MUI (mettre 8 quadruplerait tous les `sx={{borderRadius:N}}`), et les surfaces sont déjà unifiées à 8px via l'override `MuiPaper` (`'8px'` string). `index.css` + `designSystem.js` = 8px. **Tout est cohérent à 8px.** | — |
| ~~**Breakpoints divergents**~~ | ✅ **RÉSOLU (Vague 3)** — `tokens.js xl:1400` supprimé ; `muiTheme.js` aligné `1400→1280` sur `designSystem.js`. (0 usage de `theme.breakpoints` / `mq()` dans le code → impact nul.) | — |

---

## 3. Analyse des règles non respectées

### 3.1 Palette « feu tricolore » vs charte mono-accent
La charte impose **un seul accent (orange `#f26921`)** + rouge `#C04534` réservé aux NO-GO. Or de nombreux écrans réintroduisent une sémantique vert/rouge/ambre/bleu :
- [`FlightRecapTable.jsx:82-84`](src/features/flight-wizard/components/FlightRecapTable.jsx:82) : départ=vert, arrivée=rouge, déroutement=ambre.
- Graphes (`WeightBalanceChart`, `CgEnvelopeChart`, `SpeedLimitationChart`, `BezierAbacEditor`) : vert/bleu/rouge codés en dur.

**Pourquoi ça casse l'intégrité :** l'identité « cockpit sobre noir/orange » est diluée en interface SaaS multicolore ; le rouge perd sa valeur d'alerte (utilisé pour « arrivée », plus pour « NO-GO ») ; et ces teintes ne suivent **pas** le mode jour → contraste cassé en plein soleil (usage cockpit réel).

### 3.2 Restes bordeaux de l'ancienne identité — ✅ RÉSOLU (Vague 4)
> **Vague 4 appliquée** : 0 occurrence bordeaux restante (vérifié). Solides `#8b1538` → `var(--accent-primary)` ; ombres `rgba(147,22,60)`/`rgba(139,21,56)` → `rgba(0,0,0,…)` (noir sobre, charte) ; teintes/bordures → `var(--accent-soft)`. Fichiers traités : `MobileApp.jsx`, `shared/Button.jsx` (refonte complète + JSDoc corrigé), `PremiumComponents.jsx`, `DebugPanel.jsx`, `SimpleDebugButton.jsx`, `Step7Summary.jsx`, `SIAReportEnhanced.jsx`, `visualDebug.js`. (`tokens.js` supprimé en Vague 3.)

L'app avait migré bordeaux → orange, mais le bordeaux survivait dans des fichiers **structurants** :
- [`MobileApp.jsx:356`](src/MobileApp.jsx:356) `#8b1538` — **composant racine**.
- [`shared/components/Button.jsx`](src/shared/components/Button.jsx:5) — JSDoc dit *« Utilise le thème bordeaux »*, ombres `rgba(147,22,60)` (×5).
- [`styles/tokens.js:17,121,125`](src/styles/tokens.js:17), `premium/PremiumComponents.jsx`, `DebugPanel.jsx`, `Step7Summary.jsx:349`, `SIAReportEnhanced.jsx:894`.

**Pourquoi ça casse l'intégrité :** une régression du thème (ou un simple hover de bouton partagé) fait réapparaître l'ancienne couleur de marque. Ironie révélatrice : [`MobileNavigation.jsx:6`](src/shared/components/MobileNavigation.jsx:6) proclame *« Plus aucune trace de bordeaux »* tandis que `Button.jsx` voisin en est plein.

### 3.3 Le composant partagé n'est pas conforme
[`shared/components/Button.jsx`](src/shared/components/Button.jsx) est censé être LE bouton canonique, mais : (a) ombres bordeaux, (b) mélange `#f26921` littéral **et** `var(--accent-primary)` pour le même orange (lignes 52/62 vs 66/67), (c) padding/taille en dur alors que `--btn-*` existe. Un composant « source de cohérence » qui est lui-même incohérent propage l'incohérence à ses 7 consommateurs.

### 3.4 Incohérence de fond MUI vs natif
`muiTheme.js` impose `borderRadius: 2` (angles vifs) aux composants MUI, tandis que les composants natifs utilisent `--radius-sm: 8px`. **Deux familles d'arrondis cohabitent à l'écran** selon que le bouton est MUI ou natif.

---

## 4. Plan d'action & corrections définitives

### 4.1 Principe directeur : UNE source, deux miroirs générés
```
            ┌─────────────────────────────┐
            │   tokens.source.js (SoT)    │  ← on édite UNIQUEMENT ici
            │  couleurs/typo/space/radius │
            └──────────────┬──────────────┘
                generate-tokens.mjs (build)
            ┌──────────────┴──────────────┐
            ▼                              ▼
   :root { --… } (CSS)            muiTheme.js (objet MUI)
   → CSS global, inline,          → composants MUI
     classes utilitaires
```
Plus de synchro manuelle : un script génère `index.css` (`:root`) **et** `muiTheme.js` depuis le même fichier. Changer une valeur = un seul endroit.

### 4.2 Structure de configuration centralisée proposée
`src/design/tokens.source.js` (fusion de `designSystem.js`, propre, exhaustif) :
```js
export const tokens = {
  color: {
    // Accent unique (charte). AUCUNE autre teinte autorisée hors red.critical
    accent:  { primary: '#f26921', hover: '#FF7E36', active: '#D85410', soft: 'rgba(242,105,33,.16)' },
    bg:      { canvas: '#0A0A0A', surface: '#141414', overlay: '#1C1C1C', raised: '#232323' },
    text:    { primary: '#F5F2EC', secondary: '#C9C5BD', tertiary: '#8A867E', inverse: '#0A0A0A' },
    border:  { subtle: 'rgba(245,242,236,.10)', regular: 'rgba(245,242,236,.20)', ghost: 'rgba(245,242,236,.32)' },
    status:  { critical: '#C04534', criticalDim: '#8B2E22' }, // SEUL rouge, réservé NO-GO
  },
  font:   { sans: "'Century Gothic','Questrial',system-ui,sans-serif", mono: "'JetBrains Mono',monospace" },
  size:   { hero:'96px', display:'56px', h1:'40px', h2:'28px', h3:'20px', body:'15px', small:'13px', eyebrow:'11px' },
  weight: { regular:400, medium:500, semibold:600, bold:700 },
  space:  { 0:'0', 1:'4px', 2:'8px', 3:'12px', 4:'16px', 5:'20px', 6:'24px', 7:'32px', 8:'40px', 9:'48px', 10:'64px' },
  radius: { none:'0', sm:'8px', md:'12px', lg:'16px', pill:'9999px' }, // UNE échelle, fini 2/4/8
  breakpoint: { sm:640, md:768, lg:1024, xl:1280, xxl:1536 },         // UNE grille
  motion: { fast:'120ms cubic-bezier(.4,0,.2,1)', base:'180ms …', slow:'280ms …' },
  z:      { base:0, sticky:100, overlay:1000, modal:1100, alert:1200, splash:1300 },
};
```

### 4.3 Feuille de route (par ordre de ROI)
1. **Supprimer le code mort** (gain immédiat, zéro risque) : `unifiedDesignSystem.js`, `premium-theme.js`, `theme-loader.js`, `App.jsx`. *(−~50 Ko, −86 hex contradictoires)*
2. **Geler l'entropie** — ESLint custom interdisant hex/rgba/px dans `style`/`sx` (voir 4.4). Empêche toute nouvelle déviation dès maintenant.
3. **Unifier les valeurs divergentes** : radius `sm=8px` partout (corriger `tokens.js`, `muiTheme.js`), breakpoint `xl=1280` partout, police Century Gothic dans `tokens.js`.
4. **Éradiquer le bordeaux** : recherche/remplacement `147,22,60`→`var(--accent-…)`, `139,21,56`, `#8b1538`, `#B91D4C`, `#5A0C22` (cible : `MobileApp.jsx`, `Button.jsx`, `tokens.js`).
5. **Convertir la palette feu** en accent + neutres (départ/arrivée par icône/épaisseur, pas par couleur ; NO-GO seul en `#C04534`).
6. **Migrer progressivement** les 3 783 `style={{}}` vers `sx`/classes utilitaires, en commençant par le top 10 des fichiers (≈ 40 % des déviations).
7. **Fusionner** `styleSystem.js` (63 imports) + `theme.js` (21) vers `designSystem.js`/tokens, puis déprécier.

### 4.4 Garde-fou ESLint — ✅ IMPLÉMENTÉ (Vague 2)

> **État du lint existant :** `npm run lint` est **cassé** — `eslint.config.js` importe `eslint/config` (API ESLint 9) alors qu'ESLint **8.57.1** est installé (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Le garde-fou est donc **autonome** et n'en dépend pas.

**Fichiers livrés :**
- [`eslint.tokens.cjs`](eslint.tokens.cjs) — config ESLint autonome (format eslintrc, compatible v8.57). Interdit : hex en dur, `rgb()/rgba()`, px sur propriétés à échelle (`padding*`/`margin*`/`gap*`/`fontSize`/`borderRadius`), `fontWeight` numérique. Ignore les fichiers-sources de tokens (`designSystem.js`, `muiTheme.js`, `tokens.js`, `index.css`) qui SONT les valeurs de référence.
- [`scripts/lint-tokens.mjs`](scripts/lint-tokens.mjs) — runner Node multiplateforme, sans dépendance.

**Scripts npm :**
```bash
npm run lint:tokens          # fichiers modifiés vs HEAD + non suivis (défaut)
npm run lint:tokens:staged   # index uniquement (pour pre-commit hook)
npm run lint:tokens:all       # tout src/ — audit indicatif (révèle 5 446 déviations legacy)
```

**Posture :** par défaut, ne contrôle QUE le code nouveau/modifié → « gèle l'entropie » sans bloquer sur les ~5 446 déviations legacy. **Non câblé en blocage** pour l'instant (éviter de bloquer le WIP).

**Limite assumée :** lint au niveau *fichier*, pas *ligne* — éditer un fichier legacy déjà chargé en signale toutes les déviations, pas seulement les nouvelles. → activer le hook bloquant **après** nettoyage des fichiers concernés (vagues 3-7), ou l'utiliser en mode régression sur les fichiers déjà assainis.

**Pour activer le blocage au commit (optionnel, quand prêt)** — hook git simple (sans husky) :
```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run lint:tokens:staged || exit 1
```
ou, pour partager le hook via le repo : husky + lint-staged.

---

## 5. Exemples concrets « Avant / Après »

### Exemple 1 — `shared/components/Button.jsx` (composant partagé, le plus critique)
**AVANT** (bordeaux résiduel + hex dupliqués + dimensions ignorant `--btn-*`) :
```jsx
// JSDoc: "Utilise le thème bordeaux" ❌
if (variant === 'primary') {
  return {
    background: 'linear-gradient(135deg, var(--accent-primary), #FF7E36)',
    boxShadow: '0 2px 8px rgba(147, 22, 60, 0.3)',          // ❌ bordeaux
    '&:hover': { boxShadow: '0 4px 12px rgba(147, 22, 60, 0.4)' }, // ❌ bordeaux
    '&:focus-visible': { outline: '3px solid #f26921' },    // ❌ hex (= var existante)
  };
}
const getSizeStyles = () => ({ padding: '12px 24px', fontSize: '15px' }); // ❌ ignore --btn-*
```
**APRÈS** (100 % tokens, conforme charte, dimensions centralisées) :
```jsx
// JSDoc: "Bouton ALFlight — accent orange unique, dimensions via --btn-*"
if (variant === 'primary') {
  return {
    background: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    minHeight: 'var(--btn-min-height)',
    boxShadow: 'none',                                       // ✅ cockpit sobre
    '&:hover': { background: 'var(--accent-hover)' },        // ✅ token
    '&:focus-visible': { outline: '3px solid var(--accent-primary)', outlineOffset: '2px' },
  };
}
const getSizeStyles = () => ({
  padding: 'var(--btn-padding-y) var(--btn-padding-x)',     // ✅ source unique
  fontSize: 'var(--btn-font-size)',
});
```
> Effet : modifier `--btn-padding-x` dans `index.css` redimensionne **tous** les boutons ; un changement d'accent se propage sans toucher au composant.

### Exemple 2 — `FlightRecapTable.jsx` (palette feu → charte)
**AVANT** (l.82-84 + styles inline l.390) :
```jsx
const titleColor = type === 'departure' ? '#10b981'       // ❌ vert
                 : type === 'arrival'   ? '#ef4444'       // ❌ rouge ≠ charte
                 :                        '#f59e0b';       // ❌ ambre
…
<div style={{ fontSize: '8px', fontWeight: '700', color: '#10b981', marginBottom: '2px' }}>
```
**APRÈS** (accent unique + différenciation non-chromatique + tokens) :
```jsx
import { tokens } from '@/design/tokens.source';
// Différenciation par libellé/icône, PAS par couleur hors-charte
const titleColor = 'var(--accent-primary)';                // ✅ accent unique
…
<div style={{
  fontSize: tokens.size.eyebrow,                            // ✅ 11px échelle
  fontWeight: tokens.weight.bold,
  color: 'var(--accent-primary)',
  marginBottom: tokens.space[1],                            // ✅ 4px
}}>
```

### Exemple 3 — `styles/tokens.js` (fichier concurrent contradictoire → suppression/réexport)
**AVANT** (police, couleurs et échelles divergentes de la charte) :
```js
primary: { main:'#f26921', lighter:'#B91D4C', darker:'#5A0C22' }, // ❌ bordeaux
fontFamily: { primary: "'Space Grotesk','Inter',sans-serif" },     // ❌ mauvaise police
borderRadius: { sm:4, md:8 },                                       // ❌ ≠ index.css (8/12)
breakpoints: { xl:1400 },                                           // ❌ ≠ designSystem (1280)
```
**APRÈS** (devient un simple ré-export de la source unique — zéro valeur propre) :
```js
// styles/tokens.js — DÉPRÉCIÉ : ré-exporte la source unique pour compat ascendante.
// Ne plus rien définir ici. À supprimer après migration des imports.
export { tokens as default, tokens } from '@/design/tokens.source';
```

---

## 6. Impact attendu
- **−86** couleurs hex contradictoires dès la suppression du code mort (étape 1).
- **1 seul fichier à éditer** pour repalettiser toute l'app (objectif initial atteint).
- Fin des `!important` (la cascade redevient prévisible une fois les sources unifiées).
- Cohérence MUI ↔ natif (même radius, même accent, même breakpoints).

**Quick wins immédiats (ordre conseillé) :** étape 1 (code mort) → 4.4 (ESLint) → étape 3 (valeurs divergentes) → étape 4 (bordeaux). Les étapes 5-7 sont la migration de fond, à étaler.
