# ✍️ AUDIT TYPOGRAPHIQUE EXHAUSTIF — ALFlight

> Audit dédié **typographie uniquement** (tailles, graisses, italique, polices) de l'intégralité du code source.
> Date : 2026-06-04 · Périmètre : `D:\Applicator\alflight\src` (≈220 composants React, 16 modules + abac + partagés).
> Stack : React 18 + MUI v7 + Emotion + Zustand + Vite. **Pas de Tailwind.**
> Méthode : lecture des 5 fichiers de tokens/thème + 3 CSS actifs, mesures quantitatives (grep sur tout `src`), puis audit ligne-à-ligne via 8 sous-agents (un par cluster de modules). Aucune modification de code (lecture seule).

---

## 0. SYNTHÈSE EXÉCUTIVE — la cause racine

L'application **possède une excellente échelle typographique documentée** (`designSystem.js → tokens.typography` : hero/display/h1/h2/h3/body/small/eyebrow/data). **Le problème n'est pas l'absence de norme — c'est qu'aucun mécanisme ne l'impose.** Trois pathologies se cumulent et produisent l'incohérence visuelle constatée.

### Pathologie 1 — L'échelle canonique n'est branchée nulle part
- `tokens.typography` (l'échelle px éditoriale) est un objet JS **jamais consommé** hors de 4 primitives `editorial/*` (`EditorialHeading`, `DataReadout`…).
- Le **thème MUI** (`muiTheme.js`) ne définit **AUCUNE `fontSize`** — seulement les graisses de `h1`-`h6`. Donc un `<Typography variant="h2">` rend au **défaut MUI = 60px**, pas au 28px de la charte. `body2` (171 usages, le cheval de bataille) = **14px** (défaut MUI), une taille qui n'existe pas dans l'échelle.
- Résultat : **un même « h2 » a trois rendus différents** selon la façon dont il est codé :
  | Mécanisme | Rendu réel d'un « h2 » |
  |---|---|
  | `<Typography variant="h2">` | **60px** Century Gothic 600 (défaut MUI) |
  | `<h2>` natif | **32px** Space Grotesk **700 UPPERCASE** (via `unified-styles.css`) |
  | `tokens.typography.h2` | **28px** Century Gothic 500 (la charte, presque jamais utilisée) |
  | En pratique (inline) | **16-24px** selon l'écran |

### Pathologie 2 — Trois échelles de tokens concurrentes + une police interdite globale
- **`designSystem.js`** : échelle px éditoriale `{96,56,40,28,20,15,13,11}` ✅ canon.
- **`styleSystem.js`** (`sx.text.*`, 63 importateurs) : échelle **rem façon Tailwind** `xs=12 / sm=14 / base=16 / lg=18 / xl=20 / 2xl=24 / 3xl=30 / 4xl=36px`, `bold=700`. **Aucune de ces valeurs (sauf xl=20) n'est dans l'échelle canonique.** C'est la source des 14px et 18px omniprésents.
- **`theme.js`** (legacy) : `createButtonStyle` en **JetBrains Mono UPPERCASE 11px** — contredit le bouton MUI (Century Gothic 16px casse normale).
- **`unified-styles.css`** (importé globalement, **ACTIF**) impose en `!important` :
  - `--font-family: 'Space Grotesk','Inter'` sur `body` et `h1-h6` → **tout le texte natif n'est PAS en Century Gothic** (violation directe de la charte).
  - `h1-h6` natifs forcés `font-weight:700` + `text-transform:uppercase` + `letter-spacing:0.05em`, tailles `2.5/2/1.75/1.5/1.25/1rem`.

### Pathologie 3 — Hardcoding massif, gras par réflexe
Mesures sur tout `src` :

| Métrique | Valeur | Lecture |
|---|---:|---|
| `fontSize` littéraux (px/rem) | **1 573** | sur 132 fichiers |
| `fontWeight` numériques | **690** | — |
| → dont **600** (semibold) | **375** | la graisse dominante |
| → dont **500** (medium) | 184 | |
| → dont **700** (bold) | 121 | |
| → dont **400** (regular) | **9** | quasi personne ne pose « regular » |
| → dont **800** | 1 | hors échelle |
| `fontStyle: italic` | **54** | sur 28 fichiers |
| `fontFamily:'monospace'` littéral | **16** | devrait être `var(--font-sans)` (police unique) |
| `<Typography variant="h1/h2/h3">` | **6** au total | la hiérarchie de titres ne passe **pas** par les variants |
| `<Typography variant="body2">` | 171 | le défaut de fait = 14px |

> **Le chiffre le plus parlant : 375 usages de `600` contre 9 de `400`.** Le « gras » n'est pas un choix de hiérarchie, c'est l'**état par défaut** que les développeurs posent par réflexe sur les titres, les labels, les cellules de tableau et le texte secondaire. C'est la cause directe du « gras abusif » et de l'absence de hiérarchie : quand tout est en 600, rien ne ressort.

### Les 6 incohérences les plus graves (résumé)
1. **Police de marque neutralisée** : `Space Grotesk`/`Inter` forcé en `!important` sur tout le texte natif au lieu de Century Gothic (`unified-styles.css:35,78,92`).
2. **Échelle absente de MUI** : variants `h1`-`h6`/`body*`/`caption` aux défauts MUI géants (60/48/34/24px) ou minuscules.
3. **Polices hors-charte (mélange de familles)** : du `'monospace'` générique (×16), du `'system-ui'`/`'-apple-system'` et le `'Space Grotesk'` global cohabitent avec Century Gothic. → **Décision pilote : UNE seule police, Century Gothic, pour TOUT** (titres, body, labels ET valeurs). Plus de JetBrains Mono ni de monospace ; l'alignement des chiffres en colonne se fait via `font-variant-numeric: tabular-nums` (chasse fixe, même police).
4. **Micro-typographie illisible** : `fontSize` à **7 / 8 / 9 / 10px** dans les graphiques (CG, masse/centrage, vitesses), les tableaux récap (`FlightRecapTable`), et le rapport SIA. Plancher charte = 11px.
5. **Gras 600/700 systémique** sur du non-titre, et **titres sous-dimensionnés** (section à 16px) → hiérarchie écrasée.
6. **4 gabarits de boutons concurrents** (15/16/14/11px) : le « bouton canonique » `Button.jsx` lui-même ignore `--btn-font-size:16px`.

---

# PARTIE A — RAPPORT D'AUDIT MODULE PAR MODULE

> Convention de lecture. **Échelle canonique = {11, 13, 15, 20, 28, 40, 56, 96}px.** « Hors-échelle » = valeur absente de cette grille (typiquement 12/14/16/17/18/24px issus de `sx.text.*`). « Sous-plancher » = ≤10px.
>
> ⚠️ **Décision pilote (cadre cet audit) : UNE seule police — Century Gothic — pour TOUT** (titres, body, labels ET valeurs). En conséquence, les mentions « data en sans / devrait être mono » du détail ci-dessous se lisent désormais **« doit rester Century Gothic + `tabular-nums` »** : la valeur n'a pas à changer de police, seulement à utiliser des chiffres à chasse fixe. Restent des violations réelles : les polices génériques `'monospace'`, `'system-ui'`, `'-apple-system'` et `'Space Grotesk'`.

## A.0 — Fondations (fichiers de tokens / CSS globaux)

- **`src/styles/muiTheme.js`** — thème MUI actif.
  - *Problème :* `typography` (l.93-114) ne définit que les **graisses** de `h1`-`h6` + `button`, **aucune `fontSize`** → tous les variants MUI tombent sur les défauts (h1 96 / h2 60 / h3 48 / h4 34 / h5 24 / h6 20 / body1 16 / body2 14 / caption 12). `body1`/`body2`/`subtitle*`/`caption` non redéfinis.
  - *Divergence :* `h2` weight **600** ici vs **500** dans `designSystem.js`. Labels d'inputs en mono `0.12em` (l.346) vs eyebrow canon `0.20em`.
- **`src/index.css`** — source maître CSS.
  - *Problème :* **aucune variable d'échelle typographique** (`--fs-*`/`--font-size-*`). Seules 4 classes utilitaires existent (`.text-eyebrow` 0.20em, `.text-mono`, `.text-display`, `.text-hero`). Les composants n'ont donc rien à consommer pour les tailles → hardcoding inévitable.
- **`src/styles/unified-styles.css`** — CSS legacy importé globalement (ACTIF).
  - *Problème (critique) :* `--font-family:'Space Grotesk','Inter'` (l.35) appliqué `!important` sur `body` (l.78) et `h1-h6` (l.92). Native `h1-h6` (l.90-104) forcés `font-weight:700` + `uppercase` + `letter-spacing:0.05em`, tailles 2.5→1rem. `--radius-sm:4px` (l.45) en conflit avec index.css (8px).
- **`src/shared/styles/styleSystem.js`** — 2e échelle (`sx.text.*`).
  - *Problème :* `fontSize` en rem `xs..4xl` (l.82-91) = 12/14/16/18/20/24/30/36px ; `bold=700` (l.96). Échelle concurrente non alignée. `components.button.base` (l.274-275) est le **seul** élément correct (lit `var(--btn-font-size/weight)`).
- **`src/styles/theme.js`** — legacy remappé.
  - *Problème :* `createButtonStyle` (l.102-135) = JetBrains Mono **11px UPPERCASE 0.12em** — 4e gabarit de bouton, contredit le bouton MUI.

---

## A.1 — Module : aircraft (le plus dense — 402 fontSize / 196 fontWeight)

- **AircraftModule.jsx — Fiche/formulaire avion (zone legacy `AircraftForm`, ~l.3500-6250)** `features/aircraft/AircraftModule.jsx`
  - *Problème :* consomme `sx.text.*` (mauvais système) → `labelStyle` = **14px/700** sur ~30 labels ; titres natifs `<h4>` clonés en **16px/'bold'** (×16) ; sous-titres `<h5>`/`<h6>` en 12/13/14px tous en **700** ; micro-tailles **10px** ; `fontFamily:'-apple-system…'` hardcodé (l.6192/6212/6232) ; italique décoratif sur états vides.
  - *Lignes :* labels 3537-3542 (def) ; titres 16/bold 3581, 3733, 3824, 3891, 4571, 4643, 5111, 5502, 5585, 5722, 5851, 5969, 6023, 6095, 6175 ; h5/h6 700 3905-5240 ; 10px 1726, 1777, 1806, 2099, 2210, 4071 ; italique 5038, 5230.
  - *Tailles :* 10, 11, 12, 13, 14, 15, 16, 20, 22px (+ SVG 8/10/12/14). *(NB : la zone « home » l.1313-2350 est conforme — tokens, h2=28, h3=20, mono pour immat.)*
- **Wizard création avion — Étapes 1 à 7** `components/wizard-steps/Step{0..7}*.jsx`
  - *Problème transversal :* titres de section quasi tous en `subtitle1` forcé **15px/600** ; **~70 lignes body2 14px** (Step5Equipment, Step6Operations) ; `subtitle2 fontWeight={600/700}` (≈40 occurrences cumulées) ; `caption fontWeight={700}` ; `fontFamily:'monospace'` littéral (Step3WeightBalance:1159) ; `fontFamily:'system-ui'` (Step7Remarks:40) ; valeurs en **px** ET **rem** mélangées (Step0:796 `20px` vs 1105 `1.25rem`).
  - *Lignes (échantillon) :* Step5Equipment titres 123,252,502,711,896,1010,1152,1279 ; body2 14px ~140-1478 ; Step2Speeds 11px/bold 556-704 ; Step3WB h6 14/bold 1751,1881 + monospace 1159 ; Step1 subtitle2 'bold' 945-1231 ; Step5Review subtitle2 600 ×~20 (1051-1679).
  - *Tailles :* 12, 13, 14, 15, 16, 20, 24px.
- **ManexViewer.jsx — Visualiseur MANEX** `components/ManexViewer.jsx`
  - *Problème :* titres `<h3>` 20/'bold', `<h4>` 16/'bold' ; **vitesses « kt » en 16px/'bold' SANS** (l.372/395 — devraient être mono/data) ; onglets `fontWeight` conditionnel.
  - *Lignes :* 223, 302-410, 372, 395, 283. *Tailles :* 12, 13, 14, 16, 20px.
- **Graphiques (SVG) — CgEnvelopeChart / CgEnvelopeDualChart / SpeedLimitationChart** `components/`
  - *Problème :* `<text>` SVG à **7px** (Dual:148), **8px** (CgEnvelope:182, Dual:138), **9px** (Speed:279/301), **10px** ; `fontWeight="bold"` quasi partout ; couleurs `#374151`/`#9ca3af` hardcodées (CgEnvelopeChart).
  - *Tailles :* 7, 8, 9, 10, 11, 12, 13, 14px (SVG).
- **Autres :** ManexExtractionReview (10px badges/700, th 12/600), PerformanceWizard (échelle locale 14/16/**18**, 10px/bold), TableDisplay (10px généralisé, mono conditionnel OK sur nombres), AircraftDuplicator (échelle privée 24/14/12/13), UnitConverterCard (résultat 16px/700 SANS + `#0f766e` teal hors-charte), CentrogramReader (caption/subtitle2 `fontWeight={700}`), AdvancedPerformanceAnalyzer (10px/bold, 16/600).

**Synthèse aircraft.** (1) Module branché sur `sx.text.*` (mauvais système) → **14px** la taille off-scale la plus répandue. (2) **Gras 700/600 par défaut** sur titres natifs, labels, badges, captions. (3) **Titres de section à 3+ tailles** (15/16/20/24px), jamais sur h3=20/500. (4) **Micro-tailles 7-10px** concentrées dans les SVG de graphiques. (5) Valeurs techniques (vitesses, conversions) en **sans** au lieu de mono. Pires fichiers : `AircraftModule.jsx` (zone AircraftForm), `Step5Equipment/Step6Operations`, les 3 graphiques CG/Speed, `ManexViewer`.

---

## A.2 — Module : flight-wizard (284 fontSize / 217 fontWeight)

- **FlightPlanWizard.jsx — Orchestrateur (header, stepper, nav)** `features/flight-wizard/FlightPlanWizard.jsx`
  - *Problème :* SEUL fichier partiellement migré (eyebrow mono, boutons mono OK), mais redéfinit `SANS`/`MONO` en local (891-892) ; titres **24px** (`title` 908, `stepTitle` 990) et **20px** (`dialogTitle` 1109) ; `@media print` (672-693) force `h1..h6→14pt`, `p→10pt` en `!important`.
  - *Tailles :* 10, 11, 13, 14, 20, 24, 28px (+ 9/10/14pt print).
- **Step7Summary.jsx — Récapitulatif de vol (le plus dense, ~106 fontSize)** `steps/Step7Summary.jsx`
  - *Problème :* titre de carte « Résumé » en **16px** (349) ; titre d'écran « Synthèse » 16px/600 (1825) ; **17 occurrences de 700** sur en-têtes de blocs perf et valeurs ; `fontFamily:'monospace'` littéral METAR (659, 683) ; **très nombreux 10px** (763-1691) ; tailles 18/16/14/12px ; « Documents à joindre » 24px/700 UPPERCASE.
  - *Lignes :* 349, 659, 683, 713-908 (700), 1177, 1342, 1574, 1642, 1756-1758, 1825-1832 + 10px massif.
  - *Tailles :* 10, 11, 12, 13, 14, 15, 16, 18, 24px.
- **FlightRecapTable.jsx — Tableau récap PDF (paysage)** `components/FlightRecapTable.jsx`
  - *Problème (pire offender) :* micro-typo **7px** (`.recap-text-xs` l.570), **8px** (×~20), **9px** (cellules) ; **37 occurrences de 700** (quasi chaque cellule) ; palette Tailwind complète (bleu/vert/rouge/violet/ambre, l.82-84 feu tricolore) ; `<h2>` rendu à **12px/700** (596) ; `fontFamily:'inherit'` (904).
  - *Tailles :* **7, 8, 9**, 10, 11, 12px.
- **Step3VAC.jsx — Aérodromes & météo** `steps/Step3VAC.jsx`
  - *Problème :* `'monospace'` littéral ×4 (808, 1225, 1261, 1283) ; **gras 700 sur fréquences/pistes/ICAO** (942, 1173, 1221) ; titres de section à 15/16/18px (incohérents) ; pseudo-eyebrow en sans (1143) ; multiples 12px.
- **Autres :** Step1GeneralInfo (labels 16px/600, badge 10px, radio 600), Step3Route (titre 20px/700, labels 14/16px), Step7Alternates (KPI `coneInfoValueLarge` 24px/700 SANS au lieu de dataLg mono, formules 11px sans), Step6WeightBalance (titres 16px/600, `rgba(16,185,129)` vert, `color:'white'`), CollapsibleSection (`<h4>` **16px/600** — pivot de TOUS les titres de section du récap), RouteMapView/RouteStaticMapSnapshot (canvas `'14px sans-serif'`/`'bold 10px'`, tailles 10-14px). Fichiers morts : Step4Weather, Step4Alternates (cassé).

**Synthèse flight-wizard.** (1) Échelle de fait `{7,8,9,10,11,12,13,14,15,16,18,20,24}px` — un continuum de px hardcodés. (2) **68 occurrences de 700** (37 dans FlightRecapTable) sur cellules/valeurs/labels — pas des titres. (3) Titres de section pilotés par `CollapsibleSection` à 16px/600. (4) `≤10px` omniprésent, jusqu'à **7px**. (5) `'monospace'` littéral ×5 + valeurs KPI (NM/m/ft) en sans. Priorité : `CollapsibleSection`, `FlightRecapTable`, `Step7Summary`, `Step3VAC`.

---

## A.3 — Module : abac (éditeur d'abaques — 229 fontSize / 77 fontWeight)

- **Constat global :** module **100 % non thématisé** — aucun import de `designSystem.js`, aucune `var(--font-*)`, aucune police déclarée → tout hérite de **Space Grotesk** (global) ; couleurs intégralement Material (indigo/bleu/vert/violet/ambre) ; échelle Material 10/11/12/13/14/16/18/24px.
- **AbacBuilder.tsx — Constructeur de courbes** `curves/ui/AbacBuilder.tsx`
  - *Problème :* `<h2>`/`<h3>` natifs non dimensionnés → rendus **32px/28px 700 UPPERCASE Space Grotesk** (1207, 2542) à côté de titres inline 14-16px ; `fontWeight:600` sur ~10 boutons/titres ; **10px** (1760, 2004, 2015, 2687-2703) ; `fontWeight:'bold'` toggles.
  - *Tailles :* 10, 11, 12, 13, 14, 16, 18, 24px (+ h2 natif 32 / h3 natif 28).
- **AbacGraphWizard.tsx — Assistant création** `curves/ui/AbacGraphWizard.tsx`
  - *Problème :* gras 600/700 massif (17 fontWeight) sur labels/en-têtes/options ; **italique** helper text (422, 475) ; **10px** (216, 224, 479, 521).
- **CascadeCalculator.tsx / ChainCalculator.tsx** `curves/ui/`
  - *Problème :* objets `styles` hardcodés (titre 18/600, **valeur finale 24px/'bold'**) ; SVG `<text>` 10/11px + `fontWeight="bold"` (police navigateur) ; ChainCalculator n'utilise QUE `'bold'` (700).
- **AxesForm.tsx** `curves/ui/AxesForm.tsx`
  - *Problème :* **`fontFamily:'monospace'` littéral** (610, 710) ; `<h2>` inline à **14px/600** (plus petit qu'un titre de section — hiérarchie inversée) ; helperText 11px italic.
- **Autres :** GraphManager (styles 14/12/13, 10px à 260), CurveManager (italique « auto » 388, 600 sur noms, **10px** ×8), PointsTable (**coordonnées X/Y en sans** 13px, th 12/600), BezierAbacEditor.jsx (violet `#8b5cf6`, SVG sans fontFamily), AbacEditorDemoPage.jsx (`<h1>` 24px/700).

**Synthèse abac.** (1) **Sous-app entièrement hors-charte** : Space Grotesk + couleurs Material, zéro token. (2) Échelle Material 10-24px, **15/20/28/40 jamais présents**, ~25 occurrences de **10px**. (3) Gras 600/'bold' généralisé. (4) Titres natifs géants (32/28/24) vs titres inline 14-16px → hiérarchie cassée et parfois inversée. (5) Données numériques jamais en mono ; seul `'monospace'` littéral.

---

## A.4 — Module : navigation (174 fontSize / 91 fontWeight)

- **Constat global :** grep `mono` sur tout le module = **0** → **toutes les données** (coords `toFixed`, ICAO, fréquences, QFU, distances, altitudes) en **sans**. Seuls les onglets de `NavigationModule` sont en mono.
- **NavigationModule.jsx** `features/navigation/NavigationModule.jsx`
  - *Problème :* titres de section `sx.text.lg+bold` = **18px/700** (366, 427, 512) ; un `<h3>` hardcodé **16px/600** (646) → 4e format ; boutons 16px/600.
- **VFRNavigationTable.jsx — Tableau de navigation VFR** `components/VFRNavigationTable.jsx`
  - *Problème :* titre 18px/'bold' (315) ; **tableau quasi intégralement `fontWeight:'bold'`** (409-695) → hiérarchie annulée ; **tailles 12/11/10/9px** (9px italic activité/horaires 577/585/629/678) ; fréquences/coords en sans.
- **WaypointSelectorModal.jsx** `components/WaypointSelectorModal.jsx`
  - *Problème :* titre 20px/**700** ; ICAO `itemLabel` 15px/**700** SANS ; runway 16px/700 ; faux-eyebrows en sans 10-12px/600-700 ; tailles 20/16/15/14/13/12/**10**px.
- **Autres :** AirspacesSummaryTable (titres 14px/600, fréquences sans), WaypointCardWithRunways (`<h5>` 14px/700, badges **10px**, distances TORA/TODA sans), VFRPointInserter (catégories 11px/600, coords **10px** sans), CommunityPointsManager (titres 15/18px/600, 3 italiques, coords sans), GlobalVFRPointsManager (10px, coords sans), DangerousZonesDetector (h3 18/bold), AirspaceAnalyzer/RunwayAnalyzer (`sx.text.lg+bold` 18/700 cohérents mais hors-échelle).

**Synthèse navigation.** (1) **Aucune data en mono** (violation systémique). (2) **Gras 600/700 partout** — tableau VFR entier en bold. (3) Titres de section incohérents (14/16/18/20px). (4) Tailles hors-échelle + micro-textes **9-10px**. (5) Faux-eyebrows en sans. Conforme : header/onglets de `NavigationModule`.

---

## A.5 — Module : vac (110 fontSize)

- **SIAReportEnhanced.jsx — Rapport SIA / fiche aérodrome (PIRE FICHIER, 106 fontSize)** `features/vac/components/SIAReportEnhanced.jsx`
  - *Problème (3 racines) :* (a) `fontFamily:'system-ui,…'` forcé sur **tout le module** (l.584) → ni Century Gothic ni JetBrains ; (b) micro-typo **10-11px** généralisée (label 11px 740, badge 10px 758, ~20 occurrences 10px 1473-2459) ; (c) **gras 600/700 + `<strong>`** omniprésents. Titres `<h1>` 24px/700, `cardTitle` 16px/700, `<h4>` 12px/600 → 24/16/14/12px, aucun aligné. **Data DMS/fréquences/ICAO/ILS** (1086, 1317-1385, 1601, 1697, 1760) entièrement en system-ui.
  - *Tailles :* 10, 11, 12, 13, 14, 15, 16, 18, 24px.
- **VACModule.jsx — En-tête module** `features/vac/VACModule.jsx`
  - *Bon élève :* usage correct de `tokens.fontFamily.mono` + eyebrow (62-68, 91-95). Écart mineur : sous-titre 15px/600, `letterSpacing 0.12em` (vs 0.20em).

**Synthèse vac.** Contraste de maturité saisissant : `VACModule` (refait charte, propre) enveloppe `SIAReportEnhanced` (legacy : system-ui + 10px + bold sur tout, data la plus dense de l'app entièrement hors-charte).

---

## A.6 — Module : pilot (187 fontSize / 95 fontWeight)

- **PilotLogbook.jsx — Carnet de vol (62 fontSize)** `features/pilot/components/PilotLogbook.jsx`
  - *Problème :* titre « Statistiques » 18px/700 ; **KPI** (heures de vol) en **20-24px/700 SANS** + `color:'var(--app-bg)'` (texte = fond, l.1045) ; eyebrows KPI 11px sans (pas mono) ; en-têtes de formulaire 14px/700 **noir** (`rgb(0,0,0)`) sur fond sombre ; `fontFamily:'monospace'` littéral (1355) ; 10px (1582, 1602, 1661) ; route/dates/heures en sans.
  - *Tailles :* 10, 11, 13, 14, 16, 20, 24px.
- **PilotProfile.jsx — Profil** `components/PilotProfile.jsx`
  - *Problème :* config unités = valeur **18px/bold SANS** + label 12px ×12 (831-912) ; badge médical 16px/bold ; `<h4>` 16px/bold. (Bouton Save mono 11px/600 = conforme.)
- **FlightCurrencyTracker.jsx** `components/FlightCurrencyTracker.jsx`
  - *Problème :* titres de cards `<h4>` **12px/'bold'** ; lignes de statut **11px/bold** (prose en taille eyebrow) ; alerte 16px/bold ; dates en sans.
- **Autres :** PilotDashboard (le seul refait — `statValue` 18px/700 sans au lieu de dataLg mono ; `statLabel` 11px sans vs `cardHeader` mono = 2 traitements d'eyebrow), FlightHistory (tableHeader 13px/600 uppercase non-mono, dates/immat sans), PilotCertifications (h4 16px/600, dates sans, remarques italic), MedicalReminders (h4/h5 16/14px gras, 2 italiques), UnitsConfiguration (propre, mais `fieldLabel` **10px**), UnitsPreferences (via `sx`, valeurs `<strong>` sans).

**Synthèse pilot.** (1) **Gras 700/600 par défaut** (en-têtes carnet 14/700 noir, FlightCurrency tout en bold). (2) **DATA en sans** (heures, dates, comptages, unités) — seuls 3 endroits en mono. (3) Tailles hors-échelle 16/18/20/24px + **10px**. (4) Eyebrows non conformes (sans, ou mono à 0.12em, voire 10px/0.10em). (5) `color:'var(--app-bg)'` sur KPI (texte invisible). Référence : `PilotDashboard`, `UnitsConfiguration`.

---

## A.7 — Module : performance (72 fontSize / 54 fontWeight)

- **PerformanceModule.jsx** `features/performance/PerformanceModule.jsx`
  - *Problème :* titres de phase `<h2>` 18px/700 + `color:'#0e7490'` (cyan) ; **KPI conditions** valeur 16px/700 + **`color:'var(--app-bg)'`** (texte = fond, ×8) ; eyebrows 11px/600 sans `letterSpacing:0.4px` ; titres `<h4>` 13px/700 ; suffixes data (METAR/kt/°) en sans.
- **PerformanceStateMatrix.jsx** `components/PerformanceStateMatrix.jsx`
  - *Problème :* bordure `#4338ca` ; `fontFamily:'monospace'` littéral ×3 (182, 296, 381) ; **9px/10px massifs** ; compteur **18px/800** (l.116 — graisse inexistante) ; valeur 16px/700 sans.
- **Autres :** PerformanceCalculator (titres/valeurs via `sx.text.lg+bold` = 18/700, distances en sans), APIConfiguration (`sx`+600), PerformanceDataDebugger (`'monospace'` littéral, `bg=text` illisible), **APIKeyTest (100 % MUI Typography natif → défauts Roboto géants** — illustration directe du bug fondationnel).

**Synthèse performance.** (1) Tout en `fontSize:16`/`fontWeight:700` nu (sans px/token). (2) Gras 700 **et 800**. (3) DATA en sans + `'monospace'` littéral ×4. (4) **9-10px** massifs (StateMatrix). (5) `color:'var(--app-bg)'` sur KPI. (6) `APIKeyTest` = MUI pur non bridé.

---

## A.8 — Composants partagés (shared + components + racine — critiques : ils propagent)

- **shared/components/Button.jsx — « bouton canonique »** `shared/components/Button.jsx`
  - *Problème majeur :* **n'utilise PAS `--btn-font-size`/`--btn-font-weight`.** Hardcode `fontWeight:600` (32) + échelle propre 14/15/16px (104/107/109) → **15px par défaut** au lieu des **16px** imposés par `index.css`. Le composant censé centraliser diverge de la variable de centralisation.
- **Primitives `editorial/*` — la RÉFÉRENCE (avec réserves)** `shared/components/editorial/`
  - *Exemplaires :* `EditorialHeading` (mappe display/h1/h2 + eyebrow par token, zéro hardcode), `DataReadout` (data/dataLg mono par token). **À citer comme modèle.**
  - *Réserves :* `StepDial` (label **10px** + chiffres 600), `LoadingCockpit` (label **10px**), `NightModeAlert` (titre 15px/600), `EditorialButton` (3e échelle de bouton 12/13/14), `TechLabel`/`DatasheetCard`/`CockpitTextField` (tracking 0.10/0.15em vs 0.20em ; CockpitTextField helper 12px hors-échelle).
- **ValueWithUnit.jsx / ValueDisplay.jsx — afficheurs de valeurs (très réutilisés)** `shared/components/`
  - *Problème :* **pas de mono** (valeurs numériques en sans) ; `fontWeight: emphasis ? 'bold' : '600'` → **toute valeur ≥600** ; tailles 10→30px hors-échelle, dont **10px** (xs). Ces deux composants propagent l'incohérence partout.
- **Autres :** SupabaseErrorBanner (`fontFamily:'-apple-system…'` hors-charte, titre 700), TabNavigation/MobileNavigation (mono 11px OK mais tracking 0.12em, **10px** about-link, actif→600), SplashScreen (conforme, tagline 12px), DataField/DataSourceBadge (échelle `sx`, **10px**, `emphasis?600:500`), ErrorBoundary (`<h2>` `sx.text.xl+bold` = 20px/700), AccordionButton/Notification/PremiumComponents (14px/500-600 hors-échelle).
- **components/ (racine) :** LandingPage (boutons **18px/600**, 3 eyebrows **10px**, logo clamp max 72px), ALFlightSplashScreen (**48px** et **120px**, tout l'écran en mono), LoginPage (`variant="h4"` + 700 = ~34px MUI), IndexedDBChecker (`<h2>` natifs = bug Space Grotesk), WeatherRateLimitIndicator (`sx.text.sm+bold` 14/700).
- **MobileApp.jsx — racine app** : `<h2>` profileRequired **18px/700** (sous-dimensionné), fallback Suspense 18px ; 2e fallback (307-312) conforme mono.

**Synthèse partagés.** (1) **`Button.jsx` non conforme** (15px, ignore `--btn-*`) — incohérence la plus structurante. (2) **4 gabarits de boutons** (Button 14/15/16 · EditorialButton 12/13/14 · createButtonStyle 11 mono · sx.button 16 — le seul aligné), + LandingPage 18px. (3) `ValueWithUnit`/`ValueDisplay` : **data en sans + gras systématique** propagés à grande échelle. (4) **10px** dans 8+ primitives. (5) `editorial/*` **définit** correctement la charte mais ne l'**impose** pas. Tracking eyebrow divergent (0.10/0.12/0.15/0.20/0.30em).

---

## A.9 — Modules légers

- **alternates :** valeurs DATA (NM, scores %, ICAO, KPI) **en sans** ; `'monospace'` littéral ×2 (AlternateDetails 112/157) ; gras 700/600 sur badges/pastilles/boutons ; **10px** (badges Unified 259, Dual 239) ; titres `sx.text.lg` 18px/700 ; `AlternatesMapView` distance « X NM » 15px/bold sans (605).
- **weather :** METAR/TAF en `'monospace'` littéral (WeatherModule 629/648, AlternateDetails) ; vent/visi/temp/QFU/LDA/travers **en sans** ; **10px** (518/528/541/554, RunwaySuggestion 541) ; titres card 16/18px/700.
- **fuel :** **toutes les valeurs carburant en sans** (input 70, **TOTAL 14px/700** l.434 au lieu de mono dataLg, % 81) ; description **10px** (56) ; titres `sx.text.lg` 18px/700.
- **weight-balance :** `WeightBalanceChart` (SVG) = point le plus hors-charte de l'app — texte sans-serif système, couleurs `#374151/#6b7280/#dc2626/#f59e0b` hardcodées, tailles **7 / 7.5 / 8 / 9 / 10 / 12px**, **italique sur unités d'axes et formules** (388/410/580) ; ScenarioCards (tableau **9px**, formule CG italic 192) ; toutes les masses/bras/moments **en sans** (Table/Module/LoadInput).
- **checklist :** propre côté police ; défauts = échelle non respectée (12/14/16/18/20px) + titres `sx.text.xl` 20px/**700** (354/701) au lieu de 500.
- **logbook :** wrapper quasi vide (conforme) — le contenu réel vit dans `pilot/PilotLogbook`.
- **account :** titre écran **24px/600**, nom 18px/600, label section 14px/600, corps 14px ; boutons OAuth désaccordés (Apple 16px custom vs Google SDK).
- **billing (marketing) :** Paywall titre 28px/**700**, **prix 24px/700 SANS** (au lieu de dataLg mono), 7×600 ; **« Fonctionnalité PRO » en 20 / 24 / 28px** selon l'état (ProGate teaser/locked vs Paywall) ; CTA non homogènes (16/600 vs 14/500).
- **units :** UnitsModule `<h2>` 24px/'bold', **valeurs d'unités 14px/bold sans** ; UnitsPreferences via `sx.text.*` (18/700 titres, labels 14/700). Module le plus saturé en 700 sur du non-titre.
- **regulations :** ~13×600 sur labels/refs/entêtes/boutons ; titres écrasés (`<h2>`→20, `<h3>`→16) ; **référence réglementaire « SERA.xxxx » en sans/600** (au lieu de mono) ; 1 italique (note EASA 899). `RegulationsModuleSimple` = code mort (h1 24px).
- **pages :** `AbacDemo.tsx` sans typo inline (déféré à un CSS module + `<h1>` natif exposé au bug Space Grotesk).

**Synthèse légers.** Mêmes 5 patterns : **mono manquant sur la data** (NM, masses, prix, refs), **10px** (et 7-9px dans WeightBalanceChart), **600/700 sur du non-titre**, **tailles 12/14/16/18/24 hors-échelle**, **italique décoratif** (centrage, note légale).

---

# PARTIE B — LA NOUVELLE NORME TYPOGRAPHIQUE (ALFlight Type System v2)

## B.1 — UNE seule police pour tout (règle d'or)
| Famille | Police | Usage |
|---|---|---|
| **Unique** | `var(--font-sans)` = **Century Gothic** (fallbacks `URW Gothic`, `Questrial`, `Jost`) | **Absolument tout** : titres, sous-titres, body, labels, boutons, eyebrows ET valeurs chiffrées (immat, ICAO, fréquences, masses, coordonnées, heures, METAR/TAF). |

> **Décision pilote : pas de seconde famille.** On abandonne JetBrains Mono / toute police monospace. Une immatriculation, une fréquence, une masse, une heure de vol s'écrivent **en Century Gothic comme le reste**.
>
> **Pourquoi les valeurs restaient lisibles en mono :** le monospace alignait les chiffres en colonnes (tableaux de navigation, masses, fréquences). On obtient le **même alignement sans changer de police** grâce à `font-variant-numeric: tabular-nums` (chiffres à chasse fixe). C'est appliqué automatiquement par les rôles `data`/`dataLg`/`dataSm` et la classe `.t-data`. La distinction « valeur » se fait donc par la **graisse (500)** et le `tabular-nums`, pas par une autre police.
>
> En pratique : **supprimer `var(--font-mono)` et l'`@import 'JetBrains Mono'`** ; toute référence résiduelle est neutralisée en aliasant `--font-mono: var(--font-sans)` (cf. C.3).

## B.2 — L'échelle unique (rôle → taille / graisse). **Police = Century Gothic partout.**
| Rôle (token) | Taille | Graisse | Interligne | Tracking | Casse | Chiffres | Quand l'utiliser |
|---|---:|---:|---:|---|---|---|---|
| `hero` | `clamp(56,12vw,96)` | 700 | 1.0 | 0.08em | — | — | Splash uniquement |
| `display` | `clamp(40,7vw,56)` | 600 | 1.05 | −0.02em | — | — | Titre hero d'une page d'accueil |
| `h1` | **40** | 600 | 1.1 | −0.015em | — | — | Entête d'écran majeur |
| `h2` | **28** | 600 | 1.2 | −0.01em | — | — | Entête de section |
| `h3` | **20** | 600 | 1.3 | −0.005em | — | — | Titre de card / sous-section |
| `h4` | **17** | 600 | 1.35 | 0 | — | — | Titre de bloc mineur |
| `body` | **15** | **400** | 1.55 | 0 | — | — | Texte courant (défaut) |
| `bodyStrong` | 15 | 600 | 1.55 | 0 | — | — | Emphase dans une phrase |
| `small` | **13** | 400 | 1.5 | 0 | — | — | Notes secondaires |
| `caption` | **12** | 400 | 1.4 | 0 | — | — | Légendes, hints (**plancher absolu**) |
| `eyebrow` | **11** | 600 | 1.2 | **0.18em** | UPPER | — | Labels au-dessus des titres, labels de champ, en-têtes de colonne |
| `button` | **15** | 600 | 1.2 | 0.01em | — | — | Boutons (taille medium) |
| `data` | **15** | 500 | 1.4 | 0 | — | **tabular** | Valeur inline (coord, fréquence…) |
| `dataLg` | **28** | 500 | 1.1 | −0.01em | — | **tabular** | KPI / valeur principale |
| `dataSm` | **13** | 500 | 1.4 | 0 | — | **tabular** | Valeur en cellule de tableau dense |

> Tous les rôles utilisent **`var(--font-sans)` (Century Gothic)**. La colonne « Chiffres = tabular » signale les rôles « valeur » qui ajoutent `font-variant-numeric: tabular-nums` pour l'alignement en colonne (remplace l'ancien rôle du monospace).

**Décisions explicites prises pour lever les divergences existantes :**
1. **Titres `h1`-`h4` = graisse 600 (semibold).** On tranche la divergence `designSystem.js` (h2/h3=500) vs `muiTheme.js` (h2=600) **en faveur de 600** : un titre doit être nettement plus marqué que le body (400). C'est la correction directe du « titres pas assez marqués ».
2. **`h4`=17px** ajouté pour combler le trou 15→20 (les innombrables « titres de section à 16px » s'y rattachent proprement).
3. **Plancher = 12px** (`caption`), sauf `eyebrow`/`data`/`dataSm` à 11/13px qui restent lisibles grâce à `tabular-nums` (chiffres à chasse fixe, en Century Gothic). **Interdiction stricte du 7/8/9/10px.**
4. **Tracking eyebrow unifié à 0.18em** (remplace le chaos 0.10/0.12/0.15/0.20/0.30em).
5. **`button` = 15px/600** medium par défaut (et `--btn-font-size` ramené à 15px pour aligner Button.jsx, EditorialButton et le bouton MUI sur **une** valeur). *(Si la cible « ← Retour » 16px doit être conservée, garder 16 — mais **une seule** valeur partout.)*

## B.3 — Règles strictes (les interdits)
1. **Graisse.** `body`/`small`/`caption`/labels/cellules/texte secondaire = **400** (ou 500 max pour la `data`). **600 réservé aux titres `h1`-`h4`, aux boutons et à `bodyStrong`.** **700 réservé à `hero`** (et, exceptionnellement, à un état NO-GO critique). **800 interdit.** → cible : faire chuter les 375 usages de 600 et 121 de 700.
2. **Italique.** Autorisé **uniquement** pour : légendes, hints/placeholders, états vides, notes de bas de tableau. **Interdit** sur titres, valeurs, unités, et comme moyen d'emphase (utiliser la graisse ou la couleur accent). → corrige les 54 italiques (notamment WeightBalanceChart, ScenarioCards, note EASA).
3. **Police — UNE seule famille.** Century Gothic (`var(--font-sans)`) **partout, sans exception** : titres, body, labels, boutons ET valeurs. **Interdits :** `'monospace'`, `'system-ui'`, `'Space Grotesk'`, `'-apple-system…'`, `'sans-serif'` **et `var(--font-mono)`**. → corrige les 16 `'monospace'`, le `'Space Grotesk'` global et les fontFamily système.
4. **Taille.** Aucune valeur hors de l'échelle. Pas de px nu < 12. Pas de `sx.text.*` (échelle rem dépréciée).
5. **Data.** Toute valeur numérique technique = `data`/`dataLg`/`dataSm` : **même Century Gothic** que le reste, distinguée uniquement par la graisse (500) et `font-variant-numeric: tabular-nums` (alignement en colonne). Aucune police différente.
6. **Couleur de texte.** `color:'var(--app-bg)'` et `color = backgroundColor` interdits (texte invisible) — détectés sur PilotLogbook/PerformanceModule KPI.

---

# PARTIE C — LE CODE À APPLIQUER

> Principe : **une source unique** (`typography.js`) → générée/miroir dans (a) le **thème MUI** (variants), (b) les **variables CSS** `:root` (inline + natif), (c) des **classes utilitaires**. Plus de hardcoding.

## C.1 — `src/styles/typography.js` (NOUVEAU — source unique)
```js
// ============================================================================
//  ALFlight — Échelle typographique v2 (SOURCE UNIQUE)
//  Consommée par : muiTheme.js (variants MUI) + index.css (miroir CSS vars).
//  Toute taille/graisse de l'app DOIT dériver d'ici. Aucune valeur hors échelle.
// ============================================================================
// UNE seule famille pour TOUTE l'app — décision pilote (plus de JetBrains Mono / monospace).
export const FONT_SANS = "'Century Gothic','URW Gothic','Questrial','Jost',system-ui,sans-serif";

// rôle -> { taille, graisse, interligne, tracking, casse, num=chiffres tabulaires }
export const typeScale = {
  hero:       { size: 'clamp(56px,12vw,96px)', weight: 700, lh: 1.0,  ls: '0.08em' },
  display:    { size: 'clamp(40px,7vw,56px)',  weight: 600, lh: 1.05, ls: '-0.02em' },
  h1:         { size: '40px', weight: 600, lh: 1.1,  ls: '-0.015em' },
  h2:         { size: '28px', weight: 600, lh: 1.2,  ls: '-0.01em' },
  h3:         { size: '20px', weight: 600, lh: 1.3,  ls: '-0.005em' },
  h4:         { size: '17px', weight: 600, lh: 1.35, ls: '0' },
  body:       { size: '15px', weight: 400, lh: 1.55, ls: '0' },
  bodyStrong: { size: '15px', weight: 600, lh: 1.55, ls: '0' },
  small:      { size: '13px', weight: 400, lh: 1.5,  ls: '0' },
  caption:    { size: '12px', weight: 400, lh: 1.4,  ls: '0' },
  eyebrow:    { size: '11px', weight: 600, lh: 1.2,  ls: '0.18em', tt: 'uppercase' },
  button:     { size: '15px', weight: 600, lh: 1.2,  ls: '0.01em' },
  data:       { size: '15px', weight: 500, lh: 1.4,  ls: '0', num: true },
  dataLg:     { size: '28px', weight: 500, lh: 1.1,  ls: '-0.01em', num: true },
  dataSm:     { size: '13px', weight: 500, lh: 1.4,  ls: '0', num: true },
};

// Century Gothic PARTOUT. `num` => chiffres à chasse fixe (alignement colonnes) SANS changer de police.
const css = (r) => ({
  fontFamily: FONT_SANS, fontSize: r.size, fontWeight: r.weight,
  lineHeight: r.lh, letterSpacing: r.ls,
  ...(r.tt ? { textTransform: r.tt } : {}),
  ...(r.num ? { fontVariantNumeric: 'tabular-nums' } : {}),
});

// Bloc `typography` prêt pour createTheme() — branche l'échelle sur MUI.
export const muiTypography = {
  fontFamily: FONT_SANS,
  htmlFontSize: 16,
  h1: css(typeScale.h1),
  h2: css(typeScale.h2),
  h3: css(typeScale.h3),
  h4: css(typeScale.h4),
  h5: css(typeScale.h4),                 // h5 visuel = h4 (au lieu du 24px MUI)
  h6: { ...css(typeScale.h4), fontSize: '15px' }, // h6 = body+ (au lieu du 20px MUI)
  subtitle1: css(typeScale.bodyStrong),
  subtitle2: { ...css(typeScale.small), fontWeight: 600 },
  body1: css(typeScale.body),
  body2: css(typeScale.small),           // body2 (171 usages) = 13px, plus 14px
  button: css(typeScale.button),
  caption: css(typeScale.caption),
  overline: css(typeScale.eyebrow),
};

// Variants custom MUI : <Typography variant="eyebrow|data|dataLg|dataSm">
export const muiTypographyVariants = [
  { props: { variant: 'eyebrow' }, style: css(typeScale.eyebrow) },
  { props: { variant: 'data' },    style: css(typeScale.data) },
  { props: { variant: 'dataLg' },  style: css(typeScale.dataLg) },
  { props: { variant: 'dataSm' },  style: css(typeScale.dataSm) },
];
```

## C.2 — `src/styles/muiTheme.js` (MODIFIER — brancher l'échelle)
Remplacer le bloc `typography: { … }` actuel (l.93-114) par l'import de la source unique :
```js
import { muiTypography, muiTypographyVariants } from './typography';
// …
const muiTheme = createTheme({
  palette: { /* inchangé */ },

  typography: muiTypography,          // ⬅️ AVANT : seulement les graisses, aucune taille

  components: {
    MuiTypography: {                  // ⬅️ AJOUT : active variant="eyebrow|data|dataLg|dataSm"
      variants: muiTypographyVariants,
    },
    // … (overrides existants conservés)
  },
});
```
Effet : `<Typography variant="h2">` rend désormais à **28px** (et non 60px), `body2` à **13px** (et non 14px), et les variants `eyebrow`/`data` deviennent disponibles. Corrige d'un coup les ~250 `<Typography>` non bridés (LoginPage, APIKeyTest, CleanDuplicatesButton…).

## C.3 — `src/index.css` (AJOUTER les variables d'échelle dans `:root`)
À insérer après le bloc « Polices » (après l.135) — miroir exact de `typeScale` :
```css
  /* ============================================================
     ✍️ ÉCHELLE TYPOGRAPHIQUE — miroir de styles/typography.js
     Source unique pour inline styles + éléments natifs.
     ============================================================ */
  --fs-hero: clamp(56px, 12vw, 96px);
  --fs-display: clamp(40px, 7vw, 56px);
  --fs-h1: 40px;
  --fs-h2: 28px;
  --fs-h3: 20px;
  --fs-h4: 17px;
  --fs-body: 15px;
  --fs-small: 13px;
  --fs-caption: 12px;   /* plancher prose */
  --fs-eyebrow: 11px;   /* plancher (chiffres en tabular-nums) */
  --fs-data: 15px;
  --fs-data-lg: 28px;

  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  --ls-tight: -0.015em;
  --ls-eyebrow: 0.18em;

  /* 🔒 UNE seule police : on neutralise --font-mono en l'aliasant sur --font-sans,
     pour que toute référence résiduelle var(--font-mono) résolve en Century Gothic.
     → supprimer aussi l'@import 'JetBrains+Mono' en haut d'index.css (l.40). */
  --font-mono: var(--font-sans);
```
Et remplacer les classes utilitaires (compléter le bloc l.276-313) :
```css
.t-h1   { font:var(--fw-semibold) var(--fs-h1)/1.1 var(--font-sans); letter-spacing:var(--ls-tight); color:var(--text-primary); }
.t-h2   { font:var(--fw-semibold) var(--fs-h2)/1.2 var(--font-sans); letter-spacing:-0.01em; color:var(--text-primary); }
.t-h3   { font:var(--fw-semibold) var(--fs-h3)/1.3 var(--font-sans); color:var(--text-primary); }
.t-h4   { font:var(--fw-semibold) var(--fs-h4)/1.35 var(--font-sans); color:var(--text-primary); }
.t-body { font:var(--fw-regular)  var(--fs-body)/1.55 var(--font-sans); color:var(--text-primary); }
.t-small{ font:var(--fw-regular)  var(--fs-small)/1.5 var(--font-sans); color:var(--text-secondary); }
.t-caption{ font:var(--fw-regular) var(--fs-caption)/1.4 var(--font-sans); color:var(--text-tertiary); }
.t-eyebrow{ font:var(--fw-semibold) var(--fs-eyebrow)/1.2 var(--font-sans); letter-spacing:var(--ls-eyebrow); text-transform:uppercase; color:var(--text-tertiary); }
.t-data { font:var(--fw-medium) var(--fs-data)/1.4 var(--font-sans); font-variant-numeric:tabular-nums; color:var(--text-primary); }
.t-data-lg{ font:var(--fw-medium) var(--fs-data-lg)/1.1 var(--font-sans); font-variant-numeric:tabular-nums; color:var(--text-primary); }
```

## C.4 — `src/styles/unified-styles.css` (CORRECTIF CRITIQUE — plus fort ROI)
C'est le changement n°1 : il rétablit Century Gothic et une hiérarchie native saine sur **toute l'app**.
```css
/* l.35 — AVANT */
--font-family: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
/* l.35 — APRÈS : la police de marque (alias sur --font-sans d'index.css) */
--font-family: var(--font-sans);

/* l.90-104 — AVANT : h1-h6 forcés 700 UPPERCASE 0.05em, tailles rem arbitraires */
/* l.90-104 — APRÈS : alignés sur l'échelle, graisse 600, casse normale */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary) !important;
  font-family: var(--font-sans) !important;
  font-weight: var(--fw-semibold);     /* 600, plus 700 */
  text-transform: none;                /* plus d'UPPERCASE forcé */
  letter-spacing: -0.01em;
  line-height: 1.25;
}
h1 { font-size: var(--fs-h1); }   /* 40px */
h2 { font-size: var(--fs-h2); }   /* 28px */
h3 { font-size: var(--fs-h3); }   /* 20px */
h4 { font-size: var(--fs-h4); }   /* 17px */
h5 { font-size: var(--fs-body); } /* 15px */
h6 { font-size: var(--fs-small); }/* 13px */

/* l.45-49 — SUPPRIMER le bloc --radius-* (doublon en conflit avec index.css) */
```

## C.5 — `src/shared/components/Button.jsx` (CORRECTIF — bouton canonique conforme)
```jsx
// l.32 — AVANT : fontWeight: 600 (littéral)
// l.32 — APRÈS :
fontWeight: 'var(--btn-font-weight)',

// l.104-109 — AVANT : tailles hardcodées 14/16/15px par size
const getSizeStyles = () => {
  switch (size) {
    case 'small': return { padding: '8px 16px',  fontSize: '14px' };
    case 'large': return { padding: '16px 32px', fontSize: '16px' };
    default:      return { padding: '12px 24px', fontSize: '15px' };
  }
};
// l.104-109 — APRÈS : une seule source (les --btn-* d'index.css)
const getSizeStyles = () => ({
  padding: 'var(--btn-padding-y) var(--btn-padding-x)',
  fontSize: 'var(--btn-font-size)',
  minHeight: 'var(--btn-min-height)',
});
```
> Et aligner les autres gabarits : `theme.js → createButtonStyle` et `EditorialButton` doivent lire `var(--btn-font-size)`/`var(--btn-font-weight)`. Régler `--btn-font-size: 15px` dans `index.css` pour une valeur unique (cf. B.2 §5).

## C.6 — Migration des composants (recettes avant → après)
**Recette A — Titre de section hardcodé → token/classe**
```jsx
// ❌ <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Espaces aériens</h3>
// ✅ <Typography variant="h3">Espaces aériens</Typography>        // MUI
// ✅ <h3 className="t-h3">Espaces aériens</h3>                     // natif
```
**Recette B — Gras abusif sur body/label → regular**
```jsx
// ❌ <span style={{ fontSize: '14px', fontWeight: 600 }}>{label}</span>
// ✅ <span className="t-small">{label}</span>                     // 13px/400
```
**Recette C — Valeur technique → rôle `data` (Century Gothic + tabular-nums)**
```jsx
// ❌ <strong style={{ fontWeight: 700 }}>{freq} MHz</strong>      // fréquence en gras
// ✅ <span className="t-data">{freq}</span> <span className="t-eyebrow">MHz</span>
// ❌ KPI heures : <div style={{ fontSize: 24, fontWeight: 700, color:'var(--app-bg)' }}>{h}</div>
// ✅ <span className="t-data-lg">{h}</span>          // 28px Century Gothic, tabular-nums, couleur héritée
```
**Recette D — TOUTE fontFamily hors-charte → Century Gothic unique**
```jsx
// ❌ fontFamily: 'monospace' | 'system-ui' | 'Space Grotesk' | '-apple-system, …' | 'var(--font-mono)'
// ✅ fontFamily: 'var(--font-sans)'   // ou className="t-data"/"t-eyebrow" (qui l'imposent déjà)
```
**Recette E — Eyebrow / label de champ**
```jsx
// ❌ <label style={{ fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.12em' }}>
// ✅ <label className="t-eyebrow">                                // Century Gothic 11px 0.18em UPPER
```
**Recette F — Micro-typo SVG (graphiques) :** remonter tout `<text fontSize="7..10">` à **11px minimum**, `fontFamily="var(--font-sans)"` **partout** (valeurs d'axes comprises), supprimer `fontStyle="italic"` sur les unités, et `fill` via `var(--text-*)` (corrige WeightBalanceChart, CgEnvelopeChart, SpeedLimitationChart).

## C.7 — Gouvernance (empêcher la régression)
Étendre le garde-fou existant `eslint.tokens.cjs` / `scripts/lint-tokens.mjs` :
1. **Interdire `fontSize` numérique** hors `var(--fs-*)` / `tokens.typography.*` (déjà partiellement en place pour px).
2. **Interdire `fontWeight: 700|800` et `'bold'`** hors `hero`/NO-GO ; signaler `600` sur éléments non-titre.
3. **Interdire toute `fontFamily` ≠ `var(--font-sans)`** (bloque `'monospace'`, `'system-ui'`, `'Space Grotesk'`, `'-apple-system'` **et `var(--font-mono)`** — police unique).
4. **Interdire `fontSize` < 12px** (sauf `--fs-eyebrow`).
5. **Déprécier `sx.text.*`** : codemod `sx.text.lg→t-h4`, `sx.text.sm→t-small`, `sx.text.bold→` (supprimer), puis brancher `lint:tokens:staged` en pre-commit.

## C.8 — Feuille de route (par ROI décroissant)
| Vague | Action | Impact | Effort |
|---|---|---|---|
| **0** | C.4 (`unified-styles.css`) + C.2 (MUI) + C.1/C.3 (source + vars) | **Systémique** : rétablit Century Gothic partout + branche l'échelle sur tous les `<Typography>` et `<h*>` natifs | 0,5 j |
| **1** | C.5 + aligner les 4 gabarits de boutons sur `--btn-*` | Cohérence de tous les boutons | 0,5 j |
| **2** | `ValueWithUnit` + `ValueDisplay` → Century Gothic + `tabular-nums` + graisse 400/500 | Normalise l'affichage des valeurs partout où ces composants servent | 0,5 j |
| **3** | `CollapsibleSection`, `FlightRecapTable`, `Step7Summary`, `SIAReportEnhanced` | Les 4 plus gros foyers (récap vol + SIA) | 2 j |
| **4** | Graphiques SVG (WeightBalanceChart, CG, Speed) : plancher 11px, Century Gothic, sans italique | Lisibilité + charte | 1 j |
| **5** | Module `abac` : ThemeProvider + tokens (Space Grotesk → sans, Material → orange) | Sous-app entière | 2-3 j |
| **6** | Campagne codemod `sx.text.*` + `fontSize` px → classes/vars (132 fichiers) | Fond | itératif |

---

*Audit en lecture seule — aucune modification de code appliquée. Les snippets de la Partie C sont prêts à l'emploi mais doivent être appliqués et validés (build + revue visuelle) avant commit.*
