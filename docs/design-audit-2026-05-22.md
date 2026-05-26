# ALFlight — Audit design éditorial cinematic
## Vision cible : « Perita Per Preparatem » meets SR-71 aesthetic

> Auditeur : Claude Design Auditor
> Date : 2026-05-22
> Scope : 5 écrans clés (Home avions, Wizard avion, Step1, Wizard vol, Modale MANEX)
> Référence visuelle cible : sr-seventy.one (editorial dark aviation premium)

---

## 1. Score global actuel

| Critère | Score /10 | Note |
|---|---|---|
| Cohérence visuelle inter-écrans | 3/10 | Trois écosystèmes graphiques différents cohabitent : MUI v5 (Wizard avion), inline-styles+Tailwind-likes (AircraftModule, FlightPlanWizard avec `theme.colors`), et styles inline ad-hoc (ManexExtractionReview). Aucun design token partagé entre les fichiers. |
| Hiérarchie typographique | 4/10 | Tailles arbitraires : `13px`, `14px`, `15px`, `16px`, `20px`, `24px`, `28px` se croisent. Pas de police éditoriale, uniquement system fonts. Aucun letter-spacing/uppercase pour les labels techniques. |
| Contraste WCAG AA | 5/10 | Texte gris `#9CA3AF` sur fond blanc (4.3:1) frôle la limite AA. Helper text MUI hérite de `text.secondary` → souvent < 4.5:1. Boutons `rgba(55,65,81,0.35)` sur fond clair illisible. |
| Responsive (mobile/tablette/desktop) | 6/10 | MUI breakpoints utilisés correctement dans le wizard avion (`xs/sm/md`). En revanche AircraftModule et FlightPlanWizard utilisent des `width: 120px` et `maxWidth: 350` figés. Modale MANEX en `95%` width sans breakpoint mobile spécifique. |
| Identité aviation premium | 2/10 | Aucune. Emojis 📝🎯🔧⚠️📚📋📸💾🗑️ dans tout le code, alertes jaune fluo `#fef3c7`, badges arrondis style consumer-app, dégradés rose/rouge non maîtrisés. L'esthétique est celle d'un dashboard SaaS 2019, pas d'un outil cockpit. |
| Densité d'information cockpit | 4/10 | Trop d'air dans les cards (`padding: 16-24px`), mais à l'inverse les wizards empilent 50+ champs sans fiche-technique visible. Pas de zones « datasheet » à 4 coins, pas de mono numérique. Les vitesses (VSO, VS1, VNE...) sont noyées dans des MUI TextField alors qu'elles devraient être un tableau dense. |
| **TOTAL** | **24/60** | État actuel : prototype fonctionnel à refondre intégralement sur le plan visuel. Aucune dette technique structurelle bloquante côté React — la refonte est uniquement design/CSS. |

---

## 2. Inventaire par écran

### 2.1 AircraftModule.jsx — « Mes avions »

**Forces**
- Logique de complétude (`evaluateAircraft`) avec badges %, sévérité critique/required/optional bien pensée fonctionnellement.
- Photo de l'avion intégrée à la card (concept proche d'une fiche d'avion magazine).
- Liste déroulante des champs manquants déclenchable par card.

**Faiblesses**
- **Couleurs hard-codées en masse** : `#dc2626`, `#fef2f2`, `#f59e0b`, `#fffbeb`, `#3182CE`, `#EBF8FF`, `#E5E7EB`, `#9CA3AF`, `#1F2937`, `#000000`, `#374151`, `#3b82f6`, `#e5e7eb`. Aucun token utilisé.
- L'alerte « Configuration incomplète » est un bloc `#fef3c7` + `#f59e0b` + emoji ⚠️ → look « cookie-banner SaaS », antinomique du sérieux institutionnel EASA/DGAC.
- Bouton « Nouvel avion » : `#3b82f6` MUI default, ne renvoie rien d'aviation.
- `<div>` racine sans `<header>` ni titre éditorial. Pas de tagline « Le ciel se mérite au sol ».
- Cards en `border-radius: 8px` + `box-shadow` léger → look Material Design générique, pas cinematic.
- Aucune typo serif ni mono pour les immatriculations. `F-GBYU` mérite une mono-typo (style placard de cockpit).
- L'écran ne montre pas de KPI de flotte (nombre d'avions, dernière mise à jour, prochaine échéance) — alors qu'une home premium devrait avoir un mini-cockpit récap.
- Mix `lucide-react` + `MUI icons` → 2 systèmes d'icônes selon l'écran.

**Score** : 3.5/10
**Priorité refonte** : Haute (c'est la home, c'est ce que le pilote voit en premier)

---

### 2.2 AircraftCreationWizard.jsx

**Forces**
- Architecture React solide : lazy-loading des steps, bulk update, gestion de draft avec contrôle de taille.
- Stepper avec icônes MUI distinctives par étape (Flight, Scale, Speed, TrendingUp, Build, Notes, CheckCircle).
- Vue mobile dédiée du stepper avec chip de pourcentage.
- Bandeau de reprise extraction MANEX accessible toutes étapes.

**Faiblesses**
- Header : `<Typography variant="h3" color="primary.main">Assistant de création d'avion</Typography>` → titre Material générique, pas de polish éditorial. Devrait être : titre serif ivoire `Création d'avion` + tagline mono ALL CAPS au-dessus.
- Couleurs : tout passe par `primary.main` du thème MUI (probablement `#93163C` bordeaux) — mais l'usage est plat, sans gradient/contraste subtil. Le bordeaux mérite un fond sombre pour ressortir.
- `<Paper elevation={0}>` partout avec `border: '1px solid divider'` → look administratif, pas premium.
- Dialog de bypass et dialog d'annulation utilisent MUI vanilla → modales blanches sans cinematic.
- Pas d'image de fond aviation, pas d'ambiance, pas de sub-header descriptif. C'est un formulaire technocratique.
- Bouton « Annuler » couleur `error` outlined → trop visible/agressif, le pilote ne fait que poser une question, pas commettre un crime.
- Snackbar de notifications, dialog modal, alert MUI : 3 systèmes de feedback dans le même fichier. Cohérence à unifier.
- Le stepper ne montre **pas** l'estimation du temps restant (« Étape 3 sur 8 — ~12 min restantes »).

**Score** : 4/10
**Priorité refonte** : Haute (c'est l'écran le plus fréquenté en onboarding)

---

### 2.3 Step1BasicInfo.jsx

**Forces**
- 4 accordions (`identification`, `fuel`, `surfaces`, `manex`) avec exclusivité (un seul ouvert à la fois) → bonne ergonomie tactile.
- Conversion à la volée des unités (litres ↔ gallons, L/h ↔ GPH) avec affichage des 2 unités en helperText.
- Validation immatriculation avec spinner inline + warning icon.
- Photo upload avec compression côté client (1200px, JPEG 0.85) — astucieux pour Supabase JSONB.

**Faiblesses**
- Tous les champs en `maxWidth: 350px` centrés verticalement → écran desktop quasi vide, perd l'avantage de l'écran large. Devrait être une grille datasheet 2-3 colonnes.
- Accordions MUI default avec icône `ExpandMoreIcon` → look formulaire administratif type CAF. Aucune cinematic.
- Les labels d'accordion (`Identification de l'appareil`, `Carburant et performances`, `Surfaces compatibles`, `Manuel d'exploitation (MANEX)`) devraient être en mono ALL CAPS, letter-spacing 0.1em.
- Surfaces compatibles = liste de 8 checkboxes verticales avec emojis intégrés au label texte → maladroit. Devrait être une grille de chips/cards sélectionnables avec icône de surface.
- Alert MANEX `severity="warning"` → fond `#fef3c7` jaune fluo, dénote.
- Pas d'aperçu du MANEX (preview première page PDF) alors que `react-pdf` est dispo dans la stack.
- L'erreur de doublon d'immatriculation s'affiche dans un `Paper warning.50` avec 3 cards d'options → fonctionnel mais visuel sans hiérarchie.
- Tous les emojis 📝🎯⚠️✈️ injectés dans des `Typography variant="body2"` — à supprimer pour une refonte premium.
- `placeholder="F-XXXX"` correct mais aucun masque de saisie (le pilote tape `F-GBYU` sans guidance).

**Score** : 4/10
**Priorité refonte** : Haute (porte d'entrée de la création d'avion)

---

### 2.4 FlightPlanWizard.jsx

**Forces**
- Restoration des contextes (Aircraft, Navigation, Fuel, WeightBalance, Weather) au mount → très bonne UX continue.
- Barre de progression cliquable avec étapes complétées (`✓`) — pattern wizard premium.
- Brouillon localStorage + sauvegarde Supabase + génération PDF avec html2pdf.
- Dialog d'annulation à 3 actions : `Continuer`, `Annuler sans sauvegarder`, `Sauvegarder et reprendre`.
- Styles CSS print A4 dans le composant → impression cockpit prête.

**Faiblesses**
- Header `Je prépare mon vol` avec icône `<Plane size={24}>` → ton enfantin (« je prépare »), antinomique du tagline « Le ciel se mérite au sol ». Devrait être : `PRÉPARATION DE VOL` mono ALL CAPS + serif éditorial pour le contexte.
- Le `theme.colors.primary` est utilisé partout (boutons, titres, focus) → couleur unique dominante sans modulation. Le bordeaux ALFlight devrait être l'accent du contenu critique, pas la couleur de tout.
- Object `styles` inline en bas du fichier (~250 lignes) → 1 source de vérité pour ce fichier seulement, pas réutilisable.
- Brouillon : chip vert `#10b981` « Brouillon sauvegardé » → couleur safe-success consumer-app. Un cockpit dirait `DRAFT • AUTO-SAVED` en mono blanc.
- Le label des étapes (`progressLabel`) est tronqué à `maxWidth: 80px` + `whiteSpace: nowrap` → ellipse fréquente sur mobile, perte d'info.
- `borderRadius: 9999px` (pill) sur les boutons + `textTransform: 'uppercase'` + `letterSpacing: 0.05em` → tentative aviation, mais pas assez radicale et entourée d'éléments arrondis 8px qui cassent la cohérence.
- Le composant utilise `confirm()` natif du navigateur pour `handleComplete` et `handleRestart` → totalement étranger à la charte (browser dialog).
- `alert()` natif aussi pour erreurs PDF.
- Le footer/navigation ne montre pas de KPI temps restant ni indicateur de complétude global.

**Score** : 4.5/10
**Priorité refonte** : Très haute (c'est le workflow différenciant ALFlight)

---

### 2.5 ManexExtractionReview.jsx

**Forces**
- Tableau dense avec colonnes claires : Champ / Valeur / Unité cible / Source MANEX / Page / Confiance / Importer.
- Code couleur confiance (vert ≥85, jaune ≥70, orange ≥50, rouge <50) — déjà fonctionnel pour un cockpit.
- Filtres rapides (Tous / Extraits / Manquants / À vérifier / Importables).
- Actions « Accepter ≥ 70% » / « Tout accepter » → power-user friendly.
- Pages MANEX référencées (`p. 42`) → traçabilité réglementaire.
- 4 types d'inputs (text/number, select, multi-select, boolean tri-state, aeroclub autocomplete) selon la nature du champ.

**Faiblesses**
- Sparkles violet `#8b5cf6` dans le header → couleur d'IA gen-Z (ChatGPT-like), à proscrire pour un outil EASA/DGAC. Le pilote n'achète pas de la magie violette, il achète de la rigueur.
- Couleurs hard-codées : `#10b981`, `#eab308`, `#f97316`, `#ef4444`, `#fff7ed`, `#f0fdf4`, `#fafafa`, `#fed7aa`, `#9a3412`, `#fb923c`, `#dbeafe`, `#1e40af`, `#bae6fd`, `#f9fafb`, `#374151`, `#e5e7eb`, `#d1d5db`, `#6b7280`, `#9ca3af`, `#cbd5e1`, `#8b5cf6`, `#f3f4f6`, `#f0f9ff`. **22 hex codes différents** dans un seul fichier.
- Le tableau est en `fontSize: 13px` sur les valeurs et `12px` sur les unités → trop petit, pas optimisé pour tablette en cockpit (10" iPad).
- Pas de typo mono pour les valeurs numériques alors que c'est l'écran le plus orienté « données techniques ».
- Le modal occupe `95% × 92vh` → bon en desktop, mais sur mobile/tablette portrait, le tableau scrollable horizontalement devient inopérable au doigt.
- Pas d'indicateur visuel de la « confiance moyenne globale » sous forme de jauge/cercle (juste une valeur texte).
- Les emojis `✅ ❌ ⏳ ⚠ ✓` dans les radios et chips → encore une fois consumer style.
- Boutons style `btnPrimary` (violet `#8b5cf6`) / `btnSecondary` / `btnGhost` / `btnTab` définis en bas du fichier → micro design system local, à promouvoir global.

**Score** : 5/10 (le plus avancé fonctionnellement, mais le plus chargé visuellement)
**Priorité refonte** : Moyenne (refonte chromatique surtout, layout déjà bon)

---

## 3. Plan de refonte en 4 phases

### Phase 1 — Design tokens & primitives (1-2 jours)

**Fichier à créer** : `D:\Applicator\alflight\src\shared\styles\designSystem.js`

Contenu :
- Tokens couleurs (voir §4 ci-dessous) avec variables CSS root et JS export.
- Tokens typo : `--font-display` (serif éditorial), `--font-sans` (UI), `--font-mono` (données).
- Échelle d'espacement basée sur 4px : `--space-0` à `--space-24`.
- Tokens de durée d'animation : `--ease-cockpit: cubic-bezier(0.4, 0, 0.2, 1)`, `--duration-instant: 80ms`, `--duration-fast: 160ms`, `--duration-base: 280ms`.
- Tokens de shadows aviation : `--shadow-instrument` (subtil), `--shadow-floating` (modale), `--shadow-readout` (encart données).

**Primitives à créer** sous `D:\Applicator\alflight\src\shared\components\editorial\` :

| Composant | Rôle | Props clés |
|---|---|---|
| `<EditorialHeading>` | Titre serif ivoire, 3 tailles | `level: 1\|2\|3`, `eyebrow?: string` (label mono au-dessus) |
| `<TechLabel>` | Label sans-serif mono ALL CAPS pour fiches | `size: sm\|md`, `tone: muted\|accent` |
| `<DataReadout>` | Valeur numérique mono avec unité | `value: number\|string`, `unit: string`, `size: lg\|xl` |
| `<DatasheetCard>` | Card 4-coins style fiche technique | `topLeft`, `topRight`, `bottomLeft`, `bottomRight` (slots) |
| `<EditorialButton>` | Bouton corail/ivoire cinematic | `variant: primary\|ghost\|critical`, `size`, `loading` |
| `<CockpitTextField>` | Input mono, label flottant ALL CAPS | `mask?`, `unit?`, `precision?` |
| `<LoadingCockpit>` | Loader circulaire centré sobre | `message?: string` |
| `<NightModeAlert>` | Remplaçant des Alert MUI | `severity`, sans emoji, mono uppercase |
| `<StepDial>` | Stepper circulaire numéroté style instrument | `current`, `total`, `labels` |

**Polices à charger** (Google Fonts, en `<link>` dans `index.html`) :
- `Fraunces` (serif éditorial) — alternative gratuite à Editorial New / Reckless
- `JetBrains Mono` (mono technique)
- `Inter` (sans-serif UI, déjà probablement présent via MUI)

Fallback locaux : `Georgia, 'Times New Roman', serif` pour le serif, `'Courier New', monospace` pour le mono.

---

### Phase 2 — Loading + Splash (1 jour)

**Fichier à créer** : `D:\Applicator\alflight\src\shared\components\editorial\SplashScreen.jsx`

Contenu visuel :
- Fond noir profond `#08090A` plein écran.
- Photo aérienne en arrière-plan, `filter: grayscale(0.8) brightness(0.4)`.
- Logo ALFlight centré en serif ivoire `#F0E8D8` (taille XXL).
- Sous-titre mono ALL CAPS : `PERITA PER PREPARATEM • CHARGEMENT DONNÉES SIA…` (rotatif).
- Mini cercle de chargement (`stroke-dasharray` animé) en corail `#E55A4C` 24px sous le titre.
- Animation signature : trait fin horizontal qui traverse l'écran de gauche à droite (1.2s, ease-out cubic) → reprise du motif « trajectoire d'avion ».
- Texte rotatif (changement toutes les 1.5s) : `CHARGEMENT DONNÉES SIA…` → `SYNCHRONISATION SUPABASE…` → `INITIALISATION COCKPIT…` → `PRÊT POUR LE BRIEFING.`

**Composant `<LoadingCockpit>` réutilisable** : version mini du splash, en overlay sur les contenus en chargement (wizard, MANEX extraction, sauvegarde).

---

### Phase 3 — Refonte écrans clés (3-5 jours)

**Ordre de migration** (du moins risqué au plus complexe) :

1. **Jour 1 — `AircraftModule.jsx`** (home « Mes avions »)
   - Remplacer le wrapper `<div>` par un layout 2-zones : sidebar `<aside>` 280px (filtres/recherche) + main `<section>` (cards datasheet).
   - Chaque card avion devient un `<DatasheetCard>` :
     - top-L : `IMMATRICULATION` + nom mono (`F-GBYU`)
     - top-R : `STATUT` + complétion % en jauge SVG fine
     - bottom-L : `MODÈLE` + nom serif (`Diamond DA40 NG`)
     - bottom-R : `DERNIÈRE MISE À JOUR` + date mono
   - Photo de l'avion en background de la card avec overlay sombre `linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.7) 100%)`.
   - Suppression du `<Plus size={16}>` bleu → remplacer par `<EditorialButton variant="primary">` corail.

2. **Jour 2 — `AircraftCreationWizard.jsx`**
   - Header : `<EditorialHeading level={1} eyebrow="ASSISTANT • CRÉATION AVION">Nouvel appareil</EditorialHeading>`.
   - Stepper desktop : remplacer le `Stepper MUI alternativeLabel` par un `<StepDial>` horizontal compact, étapes en mono numérotées avec un trait fin connecteur.
   - Stepper mobile : conserver la logique d'1 seule étape visible, mais avec `<EditorialHeading level={3}>` + chip mono.
   - Remplacer `<Paper elevation={0}>` par un wrapper `<DatasheetCard>` sans corners (`flat=true`).
   - Bandeau MANEX vert `success.50` → tone `info-tech` : fond vert sombre `#1F3D2E` + texte ivoire + label mono `📋 MANEX EXTRAIT` → `MANEX EXTRACTION DISPONIBLE`.

3. **Jour 3 — `Step1BasicInfo.jsx`**
   - Convertir les Accordions MUI en `<Disclosure>` custom : titre `<TechLabel>` + chevron fin, animation slow.
   - Grille datasheet 2 colonnes desktop (`grid-template-columns: 1fr 1fr; gap: 32px`).
   - Tous les inputs en `<CockpitTextField>` : police mono pour les valeurs, label sans-serif ALL CAPS au-dessus (pas flottant).
   - Surfaces compatibles : grille 4×2 de chips avec icône surface (asphalt grain texture, herbe, neige…), état sélectionné = fond corail.
   - Photo : zone drop-zone 4:3 avec overlay `+ AJOUTER PHOTO APPAREIL` en mono, pas d'avatar circulaire.
   - Bloc « immatriculation existante » : remplacer le Paper warning par un `<NightModeAlert severity="info">` + 3 `<DatasheetCard>` actions horizontales.

4. **Jour 4 — `FlightPlanWizard.jsx`**
   - Header : `<EditorialHeading level={1} eyebrow="VOL #001 • EN PRÉPARATION">Briefing pré-vol</EditorialHeading>`.
   - Barre de progression : layout horizontal type instrument cockpit. Chaque étape = bloc 48×48 avec numéro mono + label en-dessous (tronqué = `text-overflow: clip` + tooltip natif HTML title).
   - Chip « Brouillon sauvegardé » : pill mono `DRAFT • AUTO-SAVED` sur fond vert sombre `#1F3D2E` avec point lumineux animé (LED style).
   - Remplacer `confirm()` natif et `alert()` natif par des `<Dialog>` custom basés sur `<DatasheetCard>`.
   - Bouton final « Terminer et Générer » → `<EditorialButton variant="critical">FINALISER LE PLAN DE VOL →</EditorialButton>`.

5. **Jour 5 — `ManexExtractionReview.jsx`**
   - Header : retirer Sparkles violet, remplacer par icône `<RadarIcon>` en corail, titre `<EditorialHeading level={2} eyebrow="EXTRACTION IA • MANEX">Validation des données</EditorialHeading>`.
   - Tableau : passer les valeurs en JetBrains Mono, agrandir à 14px desktop / 16px tablette.
   - Filtres : remplacer les pills `btnTab` par des `<TechLabel>` cliquables avec underline corail si actif.
   - Bloc métadonnées (foundCount / pagesAnalyzed / confidence) → `<DatasheetCard>` 4-coins lisible cockpit.
   - Bouton import : `<EditorialButton variant="primary">IMPORTER {count} CHAMPS →</EditorialButton>`.

---

### Phase 4 — Polish + responsive + dark mode jour (2-3 jours)

- **Mode `day-cockpit`** (par défaut sur smartphone en plein jour) :
  - Fond ivoire `#F0E8D8`, texte presque noir `#0A0C0D`.
  - Suppression de toutes les transparences (`rgba(...)`) — utiliser des aplats.
  - Contraste forcé AA partout (texte / surface ≥ 4.5:1).
  - Pas de shadows douces : remplacer par bordures 1px nettes.

- **Mode `night-cockpit`** (par défaut le soir / forçable via toggle) :
  - Fond `#08090A`, ivoire `#F0E8D8` comme texte primaire (jamais blanc pur `#FFFFFF` — agresse l'œil habitué à l'obscurité).
  - Accents corail `#E55A4C` désaturés à `#C2483D` en mode nuit pour réduire éblouissement.
  - Photos d'avion en `filter: brightness(0.7)`.

- **Toggle** : `<DayNightSwitch>` accessible depuis la barre supérieure, persistant en `localStorage`, auto-switch à partir des coordonnées GPS du device + heure SIA (soleil couché → nuit).

- **Touch targets ≥ 44px** : audit complet de tous les boutons/inputs/chips. Min height/width 44px sur mobile, 48px sur tablette.

- **Safe areas iOS** : déjà partiellement géré (`env(safe-area-inset-*)`), à généraliser à TOUTES les modales et footers fixes.

- **Animations** : réduire à `prefers-reduced-motion: reduce` → désactiver les transitions et animations.

---

## 4. Palette ALFlight Editorial v2 proposée

À déclarer dans `D:\Applicator\alflight\src\index.css` (ou équivalent) :

```css
:root {
  /* === BASE NIGHT (cockpit dark, défaut) === */
  --color-bg-deep: #08090A;          /* Fond noir profond, jamais pur black */
  --color-bg-elevated: #11141A;      /* Cards, surfaces secondaires */
  --color-bg-overlay: #1A1F26;       /* Modales, drawers */
  --color-surface-instrument: #1F242C; /* Encarts datasheet */

  /* === TYPO === */
  --color-text-primary: #F0E8D8;     /* Ivoire éditorial (pas de blanc pur) */
  --color-text-secondary: #B0A99C;   /* Ivoire désaturé pour metadata */
  --color-text-muted: #7A766C;       /* Captions, hints */
  --color-text-inverse: #0A0C0D;     /* Texte sur fond clair */

  /* === MARQUE ALFLIGHT === */
  --color-brand-bordeaux: #93163C;       /* Bordeaux ALFlight historique */
  --color-brand-bordeaux-dark: #6B1029;  /* Variante sombre pour mode jour */
  --color-brand-bordeaux-glow: #C42755;  /* Glow / hover */

  /* === ACCENT CINEMATIC (corail SR-71) === */
  --color-accent-coral: #E55A4C;         /* CTA principal, indicateur actif */
  --color-accent-coral-dim: #C2483D;     /* Variante mode nuit (désaturée) */
  --color-accent-coral-bright: #FF6E5E;  /* Hover */

  /* === SÉMANTIQUE COCKPIT === */
  --color-status-ok: #4FAE7F;            /* Vert sapin, pas vert iOS */
  --color-status-warn: #D49A3A;          /* Ambre cockpit, pas jaune fluo */
  --color-status-critical: #C04534;      /* Rouge tendu, pas rouge sang */
  --color-status-info: #5E8FB5;          /* Bleu nuit aviation */

  /* === BORDURES === */
  --color-border-subtle: rgba(240, 232, 216, 0.08);  /* 1px très discret */
  --color-border-default: rgba(240, 232, 216, 0.16); /* Cards / sections */
  --color-border-strong: rgba(240, 232, 216, 0.32);  /* Focus / hover */
  --color-border-accent: var(--color-accent-coral);  /* Sélection active */

  /* === TYPO TOKENS === */
  --font-display: 'Fraunces', 'Reckless', Georgia, 'Times New Roman', serif;
  --font-sans: 'Inter', -apple-system, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;

  --letter-spacing-tech: 0.08em;   /* labels ALL CAPS techniques */
  --letter-spacing-display: -0.02em; /* titres serif éditoriaux */
  --letter-spacing-mono: 0;        /* données numériques (déjà mono) */

  /* === ÉCHELLE TYPO === */
  --text-eyebrow: 11px;   /* label tech au-dessus d'un titre */
  --text-caption: 12px;   /* metadata */
  --text-body: 14px;      /* UI standard */
  --text-readout: 16px;   /* valeurs lisibles cockpit */
  --text-h3: 20px;        /* sous-titres */
  --text-h2: 28px;        /* titres section */
  --text-h1: 42px;        /* hero titre serif */
  --text-display: 64px;   /* splash / data XL */

  /* === SHADOWS === */
  --shadow-instrument: 0 1px 0 rgba(240, 232, 216, 0.08) inset;
  --shadow-floating: 0 20px 40px rgba(0, 0, 0, 0.6);
  --shadow-readout: 0 0 0 1px var(--color-border-default);

  /* === ANIMATIONS === */
  --ease-cockpit: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-instrument: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-instant: 80ms;
  --duration-fast: 160ms;
  --duration-base: 280ms;
  --duration-cinematic: 560ms;
}

/* === MODE JOUR (override) === */
[data-theme="day-cockpit"] {
  --color-bg-deep: #F0E8D8;
  --color-bg-elevated: #E5DCC9;
  --color-bg-overlay: #FAF5EA;
  --color-surface-instrument: #FFFFFF;

  --color-text-primary: #0A0C0D;
  --color-text-secondary: #4A4D52;
  --color-text-muted: #7A7D82;
  --color-text-inverse: #F0E8D8;

  --color-accent-coral: #C2483D;     /* corail désaturé, lisible plein jour */
  --color-border-subtle: rgba(10, 12, 13, 0.06);
  --color-border-default: rgba(10, 12, 13, 0.12);
  --color-border-strong: rgba(10, 12, 13, 0.24);
}
```

---

## 5. Recommandations typographiques

| Usage | Police | Weight | Taille | Letter-spacing | Couleur |
|---|---|---|---|---|---|
| Hero / titre splash | Fraunces | 700 | 64px | -0.02em | `var(--color-text-primary)` |
| H1 page (page title) | Fraunces | 600 | 42px | -0.02em | ivoire |
| H2 section | Fraunces | 500 | 28px | -0.01em | ivoire |
| H3 sous-section | Fraunces | 500 | 20px | 0 | ivoire |
| Eyebrow (label au-dessus titre) | Inter | 600 | 11px | 0.12em (ALL CAPS) | corail dim |
| TechLabel (champ formulaire) | Inter | 600 | 12px | 0.08em (ALL CAPS) | secondary |
| Body | Inter | 400 | 14px | 0 | primary |
| Readout (valeur numérique) | JetBrains Mono | 500 | 16px | 0 | primary |
| Readout XL (KPI vol) | JetBrains Mono | 400 | 32px | 0 | accent coral |
| Immatriculation | JetBrains Mono | 600 | 18px | 0.05em (UPPER) | primary |
| Code OACI | JetBrains Mono | 600 | 14px | 0.05em | accent |
| Caption / helper | Inter | 400 | 12px | 0 | muted |
| Bouton (CTA) | Inter | 600 | 13px | 0.08em (ALL CAPS) | accent / inverse |

**Fallbacks systématiques** :
- `font-family: 'Fraunces', 'Reckless', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;`
- `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
- `font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace;`

**font-weights utilisés** : 400, 500, 600, 700 (4 max, jamais 100/300/800/900 — verrouille la charte).

---

## 6. Checklist immédiate

- [ ] Créer `src/shared/styles/designSystem.js` avec tous les tokens du §4.
- [ ] Ajouter `<link>` Google Fonts (Fraunces, Inter, JetBrains Mono) dans `index.html`.
- [ ] Créer le dossier `src/shared/components/editorial/` avec les 9 primitives du §3 Phase 1.
- [ ] Créer `<SplashScreen>` + animation signature avant tout autre écran.
- [ ] Implémenter `<DayNightSwitch>` + persistance `localStorage` `alflight.theme`.
- [ ] Remplacer toutes les `alert()` / `confirm()` natifs par `<Dialog>` custom dans FlightPlanWizard.jsx (4 occurrences identifiées).
- [ ] Audit accessibilité : `npm install -D @axe-core/cli` puis `axe http://localhost:5173` sur les 5 écrans.
- [ ] Tester chaque écran en `prefers-color-scheme: dark` ET en mode jour ivoire.
- [ ] Désactiver MUI `<Snackbar>` (notifications) → remplacer par `<NightModeAlert>` slide-in en bas-droite.
- [ ] Supprimer **tous** les emojis dans les Typography/Alert/Button (rechercher `[🔧📝🎯⚠️📚📋📸💾🗑️✅❌⏳✓✈️]` dans le code).
- [ ] Remplacer les imports d'icônes `@mui/icons-material` par `lucide-react` (uniformisation à un seul set).
- [ ] Mesurer le bundle CSS avant/après refonte (objectif : ne pas augmenter > 8KB gzipped).
- [ ] Capturer 5 screenshots avant/après pour comparaison visuelle dans `D:\Applicator\alflight\docs\screenshots\`.

---

## 7. Top 5 actions à fort impact

### 1. Créer le système de design tokens (designSystem.js) — IMPACT MAXIMAL
**Pourquoi** : Sans cette base, chaque refonte d'écran réintroduit des hex codes. C'est la fondation. **1 jour** pour économiser **50+ heures** de duplication.
**Quoi** : Fichier `designSystem.js` avec exports JS + variables CSS root, basé sur le §4 ci-dessus.

### 2. Construire le `<SplashScreen>` cinematic avec animation signature
**Pourquoi** : C'est le « moment Wow » du pilote au lancement, le premier signal de qualité éditoriale. **Coût** : 1 jour. **ROI** : perception immédiate de premium institutionnel EASA/DGAC.
**Quoi** : Fond noir + tagline mono rotative + cercle de chargement corail + trait horizontal animé (1.2s).

### 3. Refondre `AircraftModule.jsx` en home datasheet
**Pourquoi** : C'est l'écran d'arrivée. Si la home dit « SaaS générique », tout le reste en pâtit. C'est l'écran-vitrine.
**Quoi** : Layout 2-zones (sidebar + grid de `<DatasheetCard>`), photos d'avion en background avec overlay, immatriculation en mono, suppression de toutes les alertes jaune fluo.

### 4. Unifier les feedbacks utilisateur (Alert, Snackbar, Dialog, confirm, alert)
**Pourquoi** : Aujourd'hui 5 systèmes de feedback différents cohabitent. Le pilote perd la confiance quand le visuel change selon l'action.
**Quoi** : Un seul composant `<NightModeAlert>` (slide-in bas-droite) + un seul `<Dialog>` (modale `<DatasheetCard>`). Supprimer `alert()` et `confirm()` natifs (5+ occurrences dans `FlightPlanWizard.jsx` et `Step1BasicInfo.jsx`).

### 5. Convertir toutes les valeurs numériques en `<DataReadout>` mono
**Pourquoi** : C'est le signal n°1 d'un outil aviation premium. Aujourd'hui `35 L/h` est en `<Typography variant="body2">` Inter, comme un prix Amazon. En mono ça devient `35 L/H` comme un indicateur cockpit.
**Quoi** : Wrapper `<DataReadout value={35} unit="L/H" />` partout où une valeur calculée/saisie est affichée — vitesses, poids, distances, carburant, consommations, températures.

---

## Annexe — Notes pour l'équipe technique

- **Stack actuelle** : React 18 + Vite 7 + MUI v5 + Zustand + Tailwind (?) + lucide-react + @mui/icons-material. Aucune dette structurelle, refonte purement présentation.
- **Risque MUI** : Le projet est très dépendant de MUI (`<Paper>`, `<Stepper>`, `<Accordion>`, `<TextField>`, `<Dialog>`, `<Snackbar>`...). La refonte peut soit **wrapper** les composants MUI avec une couche `editorial/`, soit **remplacer** progressivement. Recommandation : wrapper d'abord (faible risque), remplacer ensuite si bottleneck performance.
- **Photos d'avions** : déjà compressées à 1200px (`Step1BasicInfo`), parfait pour les overlays datasheet.
- **PWA** : tester le splash et le dark mode sur iOS Safari standalone (env-safe-area + theme-color manifest).
- **Loading initial** : ajouter le splash dans `index.html` AVANT React mount (HTML/CSS pur) pour éviter le flash blanc des bundles JS au lancement.

---

**Le pilote doit ressentir, en 3 secondes après lancement, qu'il est dans un cockpit institutionnel français de niveau ForeFlight, pas dans une todo-app.**

— Fin du rapport —
