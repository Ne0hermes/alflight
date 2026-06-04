# 🎨 AUDIT DE CHARTE GRAPHIQUE — ALFlight

> Audit de refonte visuelle de l'intégralité du code source.
> Date : 2026-06-04 · Périmètre : `D:\Applicator\alflight\src` (173 composants React, 12 CSS).
> Stack : React 18 + MUI v7 + Emotion + Zustand + Vite. **Pas de Tailwind** (les classes `.flex`/`.text-center` sont maison).

---

## 0. RÉSUMÉ EXÉCUTIF

La charte est **excellente et bien documentée** (noir / ivoire / orange, mono cockpit), centralisée dans 5 fichiers de tokens. Le problème n'est **pas** la charte — c'est son **application** : des milliers de valeurs hardcodées et de styles inline ad-hoc, hérités d'une époque pré-charte (palette bordeaux + thème clair SaaS), n'ont jamais été migrés.

| Catégorie d'écart | Occurrences | Fichiers concernés |
|---|---:|---|
| Couleurs **hex** hardcodées (code JS/JSX/TS) | **1 174** | 100 |
| Couleurs **hex** hardcodées (CSS) | **208** | 12 |
| **rgb()/rgba()** hardcodés (code) | **352** | ~70 |
| **`style={{…}}`** inline (JSX) | **3 791** | ~140 |
| **`fontSize:'NNpx'`** hardcodé (hors échelle) | **1 801** | 132 |
| **TOTAL approx. déviations** | **≈ 7 300** | — |

> 💡 L'équipe **connaît déjà** cette dette : `eslint.tokens.cjs` mentionne *« ≈6000 déviations existantes »* et gèle l'entropie sur les fichiers modifiés uniquement (principe « boy-scout »). Cet audit cartographie cette dette et propose un plan de résorption.

**Les 5 écarts les plus graves :**
1. **Contradiction interne** : `index.css` définit des couleurs sémantiques **vert/jaune/bleu** (`--status-success:#10b981`, `--status-warning:#fbbf24`, `--status-info:#3b82f6`) — directement **interdites** par la charte.
2. **Police hors-charte active** : `unified-styles.css` impose `--font-family: 'Space Grotesk','Inter'` en `!important` sur `body/h1-h6/button/input/label` → tout le texte natif (non-MUI) n'est **pas** en Century Gothic.
3. **Bordeaux fantôme** : `rgba(147,22,60)` (couleur historique abandonnée) subsiste **8×** dans le `unified-styles.css` actif (en-têtes de tableau, hovers, focus inputs, progress, badges).
4. **Arc-en-ciel Material/Tailwind** : ~700 couleurs hors palette (gris `#6b7280`, bleus `#3b82f6`/`#2196f3`, verts `#4caf50`/`#22c55e`, ambres `#f59e0b`/`#ff9800`, violets `#8b5cf6`).
5. **Sur-usage du rouge NO-GO** : `#C04534` (réservé aux refus catastrophiques) est employé **262×** comme rouge d'erreur générique, dans 69 fichiers.

---

## 1. LE PROFIL DE LA CHARTE CANONIQUE

### 1.1 Sources de vérité (et leur hiérarchie)

| # | Fichier | Rôle | Statut |
|---|---|---|---|
| 1 | [`src/index.css`](src/index.css) | **Source maître** : toutes les variables CSS (`--app-bg`, `--text-*`, `--accent-*`, `--radius-*`, `--btn-*`, `--input-*`…) | ✅ Canon |
| 2 | [`src/shared/styles/designSystem.js`](src/shared/styles/designSystem.js) | `tokens` JS (palette/typography/spacing/radius/shadow/motion) + `darkTheme`/`lightTheme` | ✅ Canon |
| 3 | [`src/styles/muiTheme.js`](src/styles/muiTheme.js) | Thème MUI v7 câblé sur la charte (couvre les ~24 composants MUI sans toucher leur code) | ✅ Canon |
| 4 | [`src/styles/theme.js`](src/styles/theme.js) | Shim legacy : `theme.colors.*` **remappé** vers `var(--…)` (277 consommateurs) | ⚠️ Compat (propre) |
| 5 | [`src/shared/styles/styleSystem.js`](src/shared/styles/styleSystem.js) | 2ᵉ shim : objet `theme` + classe `sx` remappés vers `var(--…)` | ⚠️ Compat (échelles divergentes) |

> ⚠️ **Risque architectural** : 5 systèmes de tokens coexistent. `theme.js` et `styleSystem.js` sont propres (ils pointent vers les variables CSS), mais `styleSystem.js` définit des **échelles divergentes** (radius `sm=2px/lg=8px`, fontSize en `rem` 0.75→2.25) qui ne correspondent ni à `index.css` ni à `designSystem.js`. → À terme, **fusionner sur une seule échelle**.

### 1.2 Couleurs officielles

**Accent unique — Orange aviation**
| Token | Hex | Usage |
|---|---|---|
| `--accent-primary` | `#f26921` | Accent unique (boutons, focus, actif) |
| `--accent-hover` | `#FF7E36` | Survol |
| `--accent-active` | `#D85410` | Pressé / actif |
| `--accent-soft` | `rgba(242,105,33,0.16)` | Overlays, focus ring, sélection |

**Noirs (mode nuit, défaut)**
| Token | Hex |
|---|---|
| `--app-bg` (maître) | `#0A0A0A` |
| `--bg-surface` | `#141414` |
| `--bg-overlay` | `#1C1C1C` |
| `--bg-raised` | `#232323` |

**Ivoire / blancs**
| Token | Hex | Usage |
|---|---|---|
| `--color-white-pure` | `#FFFFFF` | **Parcimonieux** — KPI critiques uniquement |
| `--text-primary` | `#F5F2EC` | Texte par défaut |
| `--text-secondary` | `#C9C5BD` | Secondaire |
| `--text-tertiary` | `#8A867E` | Tertiaire / placeholders / disabled |

**Rouge — RÉSERVÉ aux NO-GO catastrophiques**
| Token | Hex |
|---|---|
| `--color-red-critical` | `#C04534` |
| `--color-red-critical-dim` | `#8B2E22` |

**Bordures (alpha ivoire)** : `--border-subtle` `rgba(245,242,236,0.10)` · `--border-regular` `…0.20` · `--border-ghost` `…0.32`.

**🚫 INTERDITS explicitement par la charte** (cf. en-tête de `designSystem.js`) : bordeaux, violet, **bleu**, **vert**, **jaune/ambre**, et toute couleur sémantique SaaS. *« UNE SEULE couleur d'accent par écran : orange. »*

### 1.3 Typographie & polices

| Token | Valeur |
|---|---|
| `--font-sans` | `'Century Gothic','URW Gothic','Questrial','Jost',system-ui,sans-serif` — **partout** (titres, body, labels) |
| `--font-mono` | `'JetBrains Mono','IBM Plex Mono','Roboto Mono',…` — **data uniquement** (coords, ICAO, immat, valeurs) |

**Échelle typographique** (`designSystem.js` → `typography`) :
`hero 96px` · `display 56px` · `h1 40px` · `h2 28px` · `h3 20px` · `body 15px` · `small 13px` · `eyebrow 11px mono` · `data 15px mono` · `dataLg 28px mono`.

### 1.4 Échelles (espacement, rayons, bordures, ombres, motion)

- **Espacement** (base 4px) : `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px`.
- **Rayons** : `--radius-sm 8px` (le plus utilisé) · `--radius-md 12px` · `--radius-lg 16px` · `--radius-pill 9999px`. *(NB : MUI `shape.borderRadius:2` est volontaire — angles vifs — l'arrondi 8px des surfaces est imposé via les overrides composants.)*
- **Bordures** : `thin 1px` · `regular 1.5px` · `thick 2px` · `accent 3px`.
- **Ombres** (sobres) : `glow` (orange) · `focus` (orange) · `lift 0 8px 24px rgba(0,0,0,.40)`.
- **Boutons** (Single Source of Truth) : `--btn-padding 12px/24px` · `--btn-font-size 16px` · `--btn-min-height 48px` · `--btn-radius var(--radius-sm)`.
- **Inputs** (Single Source of Truth) : `--input-padding-y 16.5px` · `--input-bg var(--app-bg)` · `--input-radius var(--radius-sm)` · texte centré.
- **Motion** : `fast 120ms` · `base 180ms` · `slow 280ms` · `cinematic 600ms` (tous `cubic-bezier(.4,0,.2,1)`).

### 1.5 Le garde-fou existant

`npm run lint:tokens` ([`scripts/lint-tokens.mjs`](scripts/lint-tokens.mjs) + [`eslint.tokens.cjs`](eslint.tokens.cjs)) interdit déjà, sur le **code nouveau/modifié** :
- couleurs **hex** en dur → message : *« Utiliser var(--accent-primary | --text-* | --bg-* | --border-*) ou tokens.palette.* »*
- **rgb()/rgba()** en dur,
- **px** sur `padding/margin/gap/fontSize/borderRadius`,
- **fontWeight** numérique.

C'est l'infrastructure idéale pour piloter la migration (cf. §3).

---

## 2. LE REGISTRE DES ÉCARTS (la liste noire)

### 2.1 🔴 CRITIQUE — Contradictions DANS les fichiers canoniques

| Fichier:ligne | Élément | Pourquoi hors-charte |
|---|---|---|
| [`src/index.css:124-127`](src/index.css) | `--status-success:#10b981` (vert) · `--status-warning:#fbbf24` (jaune) · `--status-info:#3b82f6` (bleu) | La charte **interdit** vert/jaune/bleu. Ces tokens légitiment l'usage de couleurs sémantiques SaaS depuis la source maître. |
| `src/index.css:128-130` | `--status-*-bg` dérivés (vert/jaune/bleu translucides) | Idem — propagent les familles interdites dans `.alert-*`. |
| [`src/shared/styles/styleSystem.js:98-107`](src/shared/styles/styleSystem.js) | `borderRadius` `sm:0.125rem`(2px) … `lg:0.5rem`(8px) | 3ᵉ échelle de rayons, divergente de `index.css` (sm=8px) et `designSystem.js`. |
| `src/shared/styles/styleSystem.js:82-91` | `fontSize` en `rem` (0.75→2.25) | Échelle typo concurrente de l'échelle px canonique. |
| `src/shared/styles/styleSystem.js:108-114` | `shadow` `rgb(0 0 0 /0.05→0.1)` | Ombres calibrées pour fond clair — trop faibles sur le noir. |

> **Décision requise** : soit assumer une palette de statut (et alors la rendre cohérente charte : succès=orange/ivoire, erreur=`#C04534`), soit supprimer vert/jaune/bleu de `index.css`. **Tout le reste de l'audit dépend de cette décision.**

### 2.2 🎨 Couleurs « sauvages » — familles INTERDITES (code JS/JSX)

Toutes les valeurs ci-dessous sont des **palettes Material/Tailwind par défaut**, étrangères à la charte. Fréquences globales et fichiers porteurs :

**GRIS** (devraient être `var(--text-*)` ou `var(--bg-*)`) — *les plus nombreux*
`#6b7280`×71 · `#374151`×33 · `#d1d5db`×33 · `#666`×33 · `#111827`×27 · `#ddd`×27 · `#9ca3af`×19 · `#e5e7eb`×18 · `#333`×14 · `#f5f5f5`×11 · `#999`×10 · `#f9fafb`×10 · …
→ Concentrés dans : `FlightRecapTable.jsx` (76), `AbacGraphWizard.tsx` (49), `AbacBuilder.tsx` (44), `CascadeCalculator.tsx` (30), `WeightBalanceChart.jsx` (18), `BezierAbacEditor.jsx` (17).

**BLEU / INDIGO / VIOLET** (interdits — « un seul accent orange »)
`#3b82f6`×31 · `#2196f3`×23 · `#4338ca`×10 · `#1976d2`×9 · `#e3f2fd`×9 · `#8b5cf6`×7 · `#6366f1`×3 · `#9c27b0`×4 · `#a78bfa`×2 …
→ `AbacBuilder.tsx` (30), `AbacGraphWizard.tsx` (23), `FlightRecapTable.jsx` (16), `CascadeCalculator.tsx` (10), `GraphManager.tsx` (7), `BezierAbacEditor.jsx` (6).

**VERT / LIME** (interdits)
`#4caf50`×30 · `#22c55e`×13 · `#10b981`×12 · `#dcfce7`×6 · `#065f46`×5 · `#059669`×4 · `#16a34a`×3 · `#4fae7f`×2 · `#84cc16`×2 …
→ `AbacBuilder.tsx` (17), `AbacGraphWizard.tsx` (16), `FlightRecapTable.jsx` (11), `CascadeCalculator.tsx` (7), `SpeedLimitationChart.jsx` (3 — *exception, cf §2.7*).

**AMBRE / JAUNE / ORANGE-NON-CHARTE** (interdits — ≠ orange `#f26921`)
`#f59e0b`×16 · `#ff9800`×12 · `#92400e`×10 · `#fbbf24`×3 · `#fde68a`×3 · `#f57c00`×2 · `#ff5722`×2 · `#78350f`×2 …
→ `AbacGraphWizard.tsx` (15), `CascadeCalculator.tsx` (12), `AbacBuilder.tsx` (12), `WeightBalanceChart.jsx` (3), `AccountPanel.jsx` (2).

**ROUGE NON-CHARTE** (devrait être `#C04534`)
`#dc2626`×21 · `#ef4444`×13 · `#f44336`×11 · `#ff4444`×6 · `#d32f2f`×3 · `#991b1b`×3 · `#c62828`×2 …
→ `WeightBalanceChart.jsx` (12), `CascadeCalculator.tsx` (12), `AbacBuilder.tsx` (9), `AbacGraphWizard.tsx` (8), `FlightRecapTable.jsx` (5).

**Exemples concrets (file:line) :**
- `FlightRecapTable.jsx:82` — `` const titleColor = type==='departure' ? '#10b981' : type==='arrival' ? '#ef4444' : '#f59e0b' `` — feu tricolore vert/rouge/ambre = **3 familles interdites en 1 ligne**.
- `FlightRecapTable.jsx:315-318` — `borderLeft:'3px solid #3b82f6'` + `backgroundColor:'#eff6ff'` — bleu info.
- `FlightRecapTable.jsx:844-854` — `color:'#8b5cf6'`, `border:'2px solid #8b5cf6'` — **violet** (briefings).
- `AircraftModule.jsx:1748` — `const okColor = '#4FAE7F'; // vert sapin sémantique` — vert assumé en commentaire.
- `AircraftModule.jsx:5595-5598` — `backgroundColor:'#F0F9FF'` + `border:'1px solid #BAE6FD'` — bleu ciel (section NAV).
- `AircraftModule.jsx:5760-5763` — `backgroundColor:'#FFF7ED'` + `#FED7AA` — ambre clair (surveillance).
- `PilotDashboard.jsx:1447-1449` — `rgba(16,185,129,0.1)` — vert succès (`adviceSuccess`).
- `PilotDashboard.jsx:1458-1460` — `rgba(245,158,11,0.1)` — ambre warning (`adviceWarning`).
- `PerformanceWizard.jsx:575` — `boxShadow:'0 4px 12px rgba(30,64,175,0.3)'` — bleu au survol.
- `AbacGraphWizard.tsx:170` — couleur de courbe par défaut `#ef4444` (même pas le rouge charte).
- `BezierAbacEditor.jsx:294,486,539` — motif identitaire en **violet `#8b5cf6`** (courbe + bouton primaire + état actif).

### 2.3 🟤 Le CSS global legacy — [`unified-styles.css`](src/styles/unified-styles.css) (ACTIF)

Importé par `index.css` → **rendu dans toute l'app**. C'est le plus gros foyer d'écarts *systémiques* (avec `!important`).

| Ligne | Élément | Pourquoi hors-charte | Correctif |
|---|---|---|---|
| `:35` | `--font-family:'Space Grotesk','Inter',…` | **Police interdite**, appliquée `!important` à `body/h*/button/input/label` → texte natif **pas** en Century Gothic | `var(--font-sans)` |
| `:29-32` | `--button-bg:rgba(55,65,81,0.35)` (gris-bleu) · `--button-text:#FFFFFF` | Boutons natifs gris-bleu, en conflit `!important` avec l'orange du `muiTheme` | `var(--accent-primary)` / `var(--text-inverse)` |
| `:45-49` | `--radius-sm:4px` (+ md/lg/xl) | **Conflit** avec `index.css` (`--radius-sm:8px`) — même variable, 2 valeurs | Supprimer le bloc, garder `index.css` |
| `:216` | focus input `box-shadow:0 0 0 2px rgba(147,22,60,0.2)` | **Bordeaux** (focus ring) | `var(--accent-soft)` |
| `:335,365,381` | `.tab:hover`, `th`, `tr:hover` → `rgba(147,22,60,…)` | **Bordeaux** (hovers + en-têtes de tableau) | `var(--accent-soft)` / `var(--bg-raised)` |
| `:458,493,515,543` | dropdown/progress/badge/leaflet → `rgba(147,22,60,…)` | **Bordeaux** résiduel | tokens accent/surface |
| `:427` | `.tooltip { background:#374151 }` | Gris-bleu | `var(--bg-raised)` |
| `:467,476` | scrollbar `track:#f0f0f0` | **Gris clair** sur app sombre | `var(--bg-overlay)` |
| `:740-745` | `.vac-download-button` → `#f26921`/`#FF7E36` en dur | Bonne couleur mais **hardcodée** | `var(--accent-primary/hover)` |
| `:397-420` | `.alert-*` consomment `--status-success/warning/info` | Propagent vert/jaune/bleu (cf §2.1) | dépend décision §2.1 |

> 🔎 Le bordeaux `rgba(147,22,60)` est aussi présent dans les fichiers **morts** `global-overrides.css` (14×) et `button-rounded.css` (1×) — cf §2.6.

### 2.4 🧩 Styles inline & hardcode dans les composants — hotspots

| Fichier | `style={{}}` | hex | Écarts notables |
|---|---:|---:|---|
| [`FlightRecapTable.jsx`](src/features/flight-wizard/components/FlightRecapTable.jsx) | — | 111 | **Le pire.** Feuille « print » blanche, ignore le dark theme. 5 familles interdites (vert/rouge/ambre/bleu/violet) + `backgroundColor:'white'` + gris Tailwind. |
| [`AircraftModule.jsx`](src/features/aircraft/AircraftModule.jsx) | 349 | 18 | Objets de style inline répétés des dizaines de fois ; fonds pastel sémantiques (`#F0F9FF`, `#FFF7ED`, `#86EFAC`, `#fef3f2`) ; `rgba(55,65,81)` gris. *(Les `rgb()` lignes ~551-1155 sont du pdf-lib — **exclus**, API graphique.)* |
| [`Step7Summary.jsx`](src/features/flight-wizard/steps/Step7Summary.jsx) | 237 | 7 | Bien migré, mais `#C04534` hardcodé comme état (≠NO-GO), `fontFamily:'monospace'` au lieu de `var(--font-mono)`, **ternaires de couleur morts** (2 branches identiques). |
| [`SIAReportEnhanced.jsx`](src/features/vac/components/SIAReportEnhanced.jsx) | — | — | 106 `fontSize` px + 19 `#C04534` (bordures de champs requis). |
| [`PilotDashboard.jsx`](src/components/PilotDashboard.jsx) | 55 | 16 | `rgba` vert/ambre (advice), `#C04534` comme statut générique, anti-pattern `getStatusColor()+'20'`. |
| [`ManexViewer.jsx`](src/features/aircraft/components/ManexViewer.jsx) | 59 | 1 | Anti-pattern token fond=texte (illisible), `color:'white'`, fond `#fff4ed`. |
| [`PerformanceWizard.jsx`](src/features/aircraft/components/PerformanceWizard.jsx) | 55 | 7 | `backgroundColor:'white'`, bleu/vert en `boxShadow` hover, fond=texte. |
| [`AbacGraphWizard.tsx`](src/abac/curves/ui/AbacGraphWizard.tsx) / [`AbacBuilder.tsx`](src/abac/curves/ui/AbacBuilder.tsx) | 105/110 hex | UI d'éditeur (pas data-viz) : palette indigo/bleu/vert/ambre Material complète, MUI brut non thématisé. |

**`fontSize` px hardcodés** (échelle fantôme) : **1 801 occurrences / 132 fichiers**. Tête : `SIAReportEnhanced.jsx` (106), `Step7Summary.jsx` (106), `AircraftModule.jsx` (92), `Step5Equipment.jsx` (80), `PilotLogbook.jsx` (62), `AbacBuilder.tsx` (51).

### 2.5 ⚠️ Anti-patterns transverses (à corriger partout)

1. **Texte invisible — token fond = token texte** : `backgroundColor:'var(--text-primary)'` + `color:'var(--text-primary)'` (ivoire sur ivoire).
   *Ex.* `ManexViewer.jsx:455-457,475-477` · `PerformanceWizard.jsx:53-54,892-893`.
2. **Bordure invisible — token fond en bordure** : `border:'1px solid var(--bg-overlay)'`.
   *Ex.* `PerformanceWizard.jsx:71,76,81` (`alertSuccess/Warning/Error`).
3. **Couleur dérivée non gouvernée** : concaténation `getStatusColor(...) + '20'` / `confidenceColor(...) + '20'` (hex + alpha bricolé).
   *Ex.* `PilotDashboard.jsx:903,1070` · `ManexExtractionReview.jsx:265`.
4. **Ternaires de couleur morts** : `x ? 'var(--bg-overlay)' : 'var(--bg-overlay)'` — résidus d'anciennes logiques vert/rouge.
   *Ex.* `Step7Summary.jsx:1041`.
5. **`color:'var(--app-bg)'` utilisé comme couleur de TEXTE** (noir sur noir = invisible) — pattern historique de la migration nuit (cf. mémoire projet). À grep périodiquement.

### 2.6 🗑️ Fichiers CSS morts / orphelins (à supprimer)

Aucun n'est importé (vérifié dans `main.jsx`, `index.html`, tout `src`) — mais ils contiennent du bordeaux/Space Grotesk et risquent une réactivation par erreur :

| Fichier | Statut | Contenu problématique |
|---|---|---|
| [`src/styles/global-overrides.css`](src/styles/global-overrides.css) | Commenté dans `main.jsx` | Bordeaux ×14, Space Grotesk/Inter ×3 |
| [`src/styles/button-rounded.css`](src/styles/button-rounded.css) | Commenté | Bordeaux ×1 |
| [`src/styles/aircraft-fixes.css`](src/styles/aircraft-fixes.css) | Commenté | legacy |
| [`src/styles/unified-button-style.css`](src/styles/unified-button-style.css) | **Non référencé** | legacy |
| [`src/mobile.css`](src/mobile.css) | **Non référencé** | à vérifier |
| [`src/features/navigation/components/AirportSelectorSIA.css`](src/features/navigation/components/AirportSelectorSIA.css) | **Non référencé** | à vérifier |
| [`src/designs/figma/example-background.css`](src/designs/figma/example-background.css) | **Non référencé** | exemple Figma |

### 2.7 ✅ Exceptions LÉGITIMES (à NE PAS « corriger »)

- **[`SpeedLimitationChart.jsx`](src/features/aircraft/components/SpeedLimitationChart.jsx)** — les arcs **blanc / vert / jaune / rouge** sont les **marquages normalisés d'anémomètre (OACI/EASA)** (Vso–Vfe, Vno–Vne…). Les « orangifier » serait une **faute métier**. → Documenter via `--asi-arc-*` mais conserver les teintes réglementaires.
- **Génération PDF (pdf-lib)** dans `AircraftModule.jsx` (~l.551-1155) et exports : les `rgb(0.8,0,0)` (floats 0-1) sont l'API graphique pdf-lib, **pas du CSS**. Hors périmètre charte écran.
- **Cartes Leaflet / tuiles** : les couleurs de fond carto ne sont pas régies par la charte UI.
- **`theme.js` / `styleSystem.js`** : les `var(--…)` qu'ils exposent **ne sont pas** des écarts (ce sont des shims propres).

---

## 3. PLAN DE RECOMMANDATIONS & MIGRATION

### 3.1 Stratégie générale

> **Ne pas tout migrer d'un coup** (≈7 300 points). Procéder par **vagues priorisées**, en s'appuyant sur le garde-fou `lint:tokens` déjà en place. Décision préalable obligatoire : **§2.1 (palette de statut)**.

### 3.2 Quick wins (1 PR, fort impact, faible risque)

1. **Trancher la palette statut** (§2.1). Recommandé : aligner `--status-*` sur la charte —
   ```css
   /* index.css — variante charte cockpit */
   --status-success: var(--accent-primary);   /* orange, pas de vert SaaS */
   --status-warning: var(--accent-primary);
   --status-info:    var(--text-secondary);    /* neutre ivoire, pas de bleu */
   --status-error:   var(--color-red-critical);
   ```
   (cohérent avec `muiTheme.js` et `theme.js` qui ont **déjà** fait ce choix).
2. **`unified-styles.css`** : `--font-family` → `var(--font-sans)` ; supprimer le bloc `--radius-*` (doublon) ; `--button-bg/text` → tokens accent ; remplacer les 8 `rgba(147,22,60)` par `var(--accent-soft)`/`var(--bg-raised)` ; `#374151`/`#f0f0f0` → `var(--bg-raised)`/`var(--bg-overlay)`.
3. **Supprimer les 7 CSS morts** (§2.6) après confirmation `git grep`.
4. **`FlightRecapTable.jsx`** : c'est 1 fichier pour ~130 écarts — le plus gros ratio effort/impact.

### 3.3 Refactoring par cas fréquent (avant → après)

**Cas A — Couleur de statut sémantique hardcodée** *(le plus fréquent)*
```jsx
// ❌ AVANT — FlightRecapTable.jsx:82
const titleColor = type === 'departure' ? '#10b981'   // vert interdit
                 : type === 'arrival'   ? '#ef4444'   // rouge non-charte
                 :                        '#f59e0b';  // ambre interdit
// ✅ APRÈS — un seul accent + rouge réservé au vrai NO-GO
const titleColor = isNoGo ? 'var(--color-red-critical)' : 'var(--accent-primary)';
```

**Cas B — Gris Material → token ivoire/surface**
```jsx
// ❌ color:'#6b7280'  ·  color:'#111827'  ·  border:'1px solid #e5e7eb'
// ✅ color:'var(--text-tertiary)' · color:'var(--text-primary)' · border:'1px solid var(--border-subtle)'
```

**Cas C — Fond pastel de section → surface cockpit**
```jsx
// ❌ AircraftModule.jsx:5595 — backgroundColor:'#F0F9FF', border:'1px solid #BAE6FD'
// ✅ backgroundColor:'var(--bg-overlay)', border:'1px solid var(--border-subtle)'
//    (accent éventuel via borderLeft:'3px solid var(--accent-primary)')
```

**Cas D — Anti-pattern fond=texte (illisible)**
```jsx
// ❌ ManexViewer.jsx:475 — backgroundColor:'var(--text-primary)', color:'var(--text-primary)'
// ✅ backgroundColor:'var(--accent-primary)', color:'var(--text-inverse)'
```

**Cas E — `fontSize` px → échelle / classe utilitaire**
```jsx
// ❌ <span style={{ fontSize:'11px', fontFamily:'monospace' }}>
// ✅ <span className="text-eyebrow">              // classe déjà dans index.css
//    ou style={{ fontSize: tokens.typography.eyebrow.fontSize }}  // depuis designSystem.js
```

**Cas F — Objets de style inline répétés → constantes partagées**
`AircraftModule.jsx` répète des dizaines de fois le même conteneur de section + `<h4>`. → Extraire dans `designSystem.js` (ex. `tokens.patterns.sectionCard`) ou utiliser les classes `.alflight-card` / `.alflight-card-header` **déjà existantes** dans [`alflight-components.css`](src/styles/alflight-components.css).

**Cas G — Couleurs de graphiques → tokens data-viz charte**
Créer une mini-échelle de séries cohérente (dégradés d'orange + neutres ivoire) plutôt que l'arc-en-ciel Material :
```js
// designSystem.js — à ajouter
export const chartTokens = {
  axis:'var(--text-tertiary)', grid:'var(--border-subtle)', label:'var(--text-secondary)',
  series:['#f26921','#FF7E36','#D85410','#C9C5BD','#8A867E'], // orange→ivoire
  envelopeFill:'rgba(242,105,33,0.16)', envelopeStroke:'var(--accent-primary)',
  limitNoGo:'var(--color-red-critical)', // SEUL usage légitime du rouge
};
```
Modèle propre déjà existant à généraliser : **[`CgEnvelopeDualChart.jsx`](src/features/aircraft/components/CgEnvelopeDualChart.jsx)** (axes en `var(--*)`). À l'inverse, **`CgEnvelopeChart.jsx`** est un thème clair complet à réécrire.

### 3.4 Priorisation (vagues)

| Vague | Cible | Volume | Effort |
|---|---|---|---|
| **0** | Décision palette statut (§2.1) + `unified-styles.css` + suppression CSS morts | ~40 pts systémiques | 0,5 j |
| **1** | `FlightRecapTable.jsx` (réécriture dark) | ~130 | 1 j |
| **2** | Éditeurs ABAC (`AbacGraphWizard`, `AbacBuilder`, `BezierAbacEditor`, `CascadeCalculator`) — UI hors-charte | ~250 | 2-3 j |
| **3** | Data-viz (`WeightBalanceChart`, `CgEnvelopeChart`) via `chartTokens` ; **exception** SpeedLimitation | ~80 | 1 j |
| **4** | Fonds pastel + objets inline `AircraftModule.jsx` | ~30 + factorisation | 1-2 j |
| **5** | Rationaliser le sur-usage de `#C04534` (262×) : `var(--color-red-critical)` **uniquement** sur vrais NO-GO ; le reste → orange/ivoire | 69 fichiers | itératif |
| **6** | Campagne `fontSize` px → tokens/classes (1 801×) | 132 fichiers | itératif (codemod) |

### 3.5 Gouvernance (empêcher la régression)

- **Renforcer `lint:tokens`** : ajouter une règle interdisant `fontFamily` ≠ `var(--font-*)` et les **noms de couleurs** (`'white'`, `'black'`, `'red'`…). Brancher `lint:tokens:staged` en **pre-commit** (Husky) — déjà prévu dans les scripts npm.
- **Codemod** : un script (jscodeshift) qui mappe les hex connus → `var(--…)` automatiserait 60-70 % des cas B/C.
- **Au fil de l'eau** : `npm run lint:tokens:all` en CI (non bloquant) pour suivre la courbe de dette descendre.
- **Cible** : ramener `lint:tokens:all` à 0 erreur, puis le passer **bloquant**.

---

*Méthodologie : lecture des 5 fichiers de tokens + 3 CSS actifs ; tables de fréquence exhaustives (grep hex/rgba/inline/fontSize sur tout `src`) ; audit ligne-à-ligne des 13 fichiers les plus denses via 2 sous-agents. Aucune modification de code effectuée — audit en lecture seule.*
