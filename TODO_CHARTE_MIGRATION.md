# ✅ TODO — Migration charte graphique ALFlight

> Checklist d'exécution dérivée de [`AUDIT_CHARTE_GRAPHIQUE.md`](AUDIT_CHARTE_GRAPHIQUE.md).
> Ordre = priorité (rentabilité / risque). Cocher au fur et à mesure.
> Règle d'or : **aucune nouvelle valeur hardcodée** — `var(--…)` ou `tokens.*` uniquement. Vérifier `npm run lint:tokens` après chaque lot.

---

## 🚧 VAGUE 0 — Fondations systémiques *(0,5 j · faible risque · fort impact)*

- [ ] **0.1 — DÉCISION BLOQUANTE : palette de statut.** Trancher entre :
  - **(A) Mode charte (recommandé)** : `--status-success/warning` → `var(--accent-primary)`, `--status-info` → `var(--text-secondary)`, `--status-error` → `var(--color-red-critical)`. *(= choix déjà fait par `muiTheme.js` et `theme.js`.)*
  - **(B) Assumer une palette statut** : conserver vert/jaune/bleu mais les rendre cohérents et documentés.
  > ⚠️ Tout le traitement des couleurs sémantiques (vagues 1, 5, 6) dépend de ce choix.
- [ ] **0.2** — `index.css:124-131` : appliquer la décision 0.1 sur `--status-*` et `--status-*-bg`.
- [ ] **0.3** — `unified-styles.css:35` : `--font-family` → `var(--font-sans)` (supprime Space Grotesk/Inter actifs).
- [ ] **0.4** — `unified-styles.css:45-49` : **supprimer** le bloc `--radius-*` (doublon en conflit : 4px vs 8px d'`index.css`).
- [ ] **0.5** — `unified-styles.css:29-32` : `--button-bg`/`--button-text` → `var(--accent-primary)`/`var(--text-inverse)` (boutons natifs gris-bleu).
- [ ] **0.6** — `unified-styles.css` : remplacer les **8× `rgba(147,22,60)`** (bordeaux) — l.216 (focus input), 335 (tab hover), 365 (`th`), 381 (`tr:hover`), 458 (dropdown), 493 (progress), 515 (badge), 543 (leaflet) → `var(--accent-soft)` / `var(--bg-raised)`.
- [ ] **0.7** — `unified-styles.css:427,467,476` : `#374151` (tooltip), `#f0f0f0` (scrollbar) → `var(--bg-raised)` / `var(--bg-overlay)`.
- [ ] **0.8** — `unified-styles.css:740-745` : `.vac-download-button` `#f26921`/`#FF7E36` → `var(--accent-primary)`/`var(--accent-hover)`.
- [ ] **0.9** — Supprimer les **7 CSS morts** (après `git grep` de confirmation) : `global-overrides.css`, `button-rounded.css`, `aircraft-fixes.css`, `unified-button-style.css`, `mobile.css`, `AirportSelectorSIA.css`, `designs/figma/example-background.css`.
- [ ] **0.10** — ✅ Vérifier au rendu (preview) : boutons (orange ?), en-têtes tableaux (plus de bordeaux ?), scrollbar, alertes, police corps de texte.

## ✅ VAGUE 1 — `FlightRecapTable.jsx` — FAIT (brand-align, PAS darkify)

> ⚠️ **Prémisse corrigée** : ce fichier n'est PAS de l'UI écran à « darkifier ». C'est la
> **SOURCE du PDF** de plan de vol, capturée à l'écran via `html2canvas` (FlightPlanWizard).
> Le fond blanc + texte sombre sont **indispensables à l'impression**. Décision retenue :
> **brand-align** — garder le blanc, remplacer les teintes décoratives par l'orange charte.

- [x] **1.1** — En-têtes de section (départ/arrivée/déroutement) + nav + horaires + TOD → `PRINT.accent` (orange ; distinction par le label, pas par la couleur).
- [x] **1.2** — Bleu `#3b82f6`, vert déco `#10b981`, violet `#8b5cf6`, indigo `#6366f1`, ambre `#f59e0b` + tints `#eff6ff/#f0fdf4/#f5f3ff/#dbeafe` → `PRINT.accent` / `PRINT.accentBg`.
- [x] **1.3** — GO/NO-GO **fonctionnel** : `#dc2626` → `PRINT.nogo` (#C04534) ; vert OK `#059669` conservé (`PRINT.ok`, sécurité).
- [x] **1.4** — Palette `PRINT` locale centralisée + en-tête `eslint-disable no-restricted-syntax` documentant l'exception print.
- [x] **1.5** — Gris neutres (texte/bordures/blanc) **conservés** (corrects pour l'impression). 0 teinte hors-charte restante, fichier parse OK.
- [ ] **1.6** — ⏳ Vérif visuelle écran + **génération PDF réelle** (à faire quand le dev server parallèle est libre).

> 📌 Audit à mettre à jour : reclasser `FlightRecapTable.jsx` en **artefact d'impression brand-aligné** (exception médium), non plus « pire offenseur à darkifier ».

## 🎛️ VAGUE 2 — Éditeurs ABAC *(2-3 j · UI hors-charte, pas data-viz)*

- [ ] **2.1** — `AbacGraphWizard.tsx` : `btnStyle()` (l.196-209), couleur courbe par défaut `#ef4444` (l.170), palette indigo/bleu/vert/ambre → tokens.
- [ ] **2.2** — `AbacBuilder.tsx` : MUI brut non thématisé (`#4CAF50`/`#2196F3`/`#9E9E9E` l.1213-1396) + gris → tokens.
- [ ] **2.3** — `BezierAbacEditor.jsx` : motif identitaire **violet `#8b5cf6`** (l.294,486,539) → orange ; poignées/resize → accent/neutre.
- [ ] **2.4** — `CascadeCalculator.tsx`, `CurveManager.tsx`, `GraphManager.tsx`, `AxesForm.tsx`, `ChainCalculator.tsx`, `PointsTable.tsx` : mêmes familles.
- [ ] **2.5** — `abac/curves/ui/styles.module.css` : auditer + tokeniser.

## 📊 VAGUE 3 — Data-viz *(1 j · tokeniser, préserver exceptions)*

- [ ] **3.1** — Créer `chartTokens` dans `designSystem.js` (axes/grid/label + séries orange→ivoire + envelope + `limitNoGo`).
- [ ] **3.2** — `WeightBalanceChart.jsx` : 4 séries Material (l.280-283) → `chartTokens.series` ; hors-limites `#dc2626`/`#ef4444` → `limitNoGo` ; enveloppe bleue → orange.
- [ ] **3.3** — `CgEnvelopeChart.jsx` : réécrire le thème **clair** complet (`#f8fafc`/white/`#cbd5e1`) en dark (modèle `CgEnvelopeDualChart`).
- [ ] **3.4** — `CgEnvelopeDualChart.jsx` : corriger le seul vert `#22c55e` (l.118-130).
- [ ] **3.5** — `SpeedLimitationChart.jsx` : **EXCEPTION** — créer `--asi-arc-*` documentés, **NE PAS** orangifier les arcs (marquages OACI/EASA) ; migrer seulement le chrome gris.

## 🛩️ VAGUE 4 — `AircraftModule.jsx` + factorisation *(1-2 j)*

- [ ] **4.1** — Fonds pastel sections : `#F0F9FF`/`#BAE6FD` (l.5595), `#FFF7ED`/`#FED7AA` (l.5760), `#86EFAC` (l.5864), `#fef3f2` (l.4741) → `var(--bg-overlay)` + `borderLeft` accent.
- [ ] **4.2** — `rgba(55,65,81,0.35)` gris (l.151,163), `rgba(34,197,94,0.2)` vert SVG (l.5436), `#4FAE7F` (l.1748), `rgba(239,68,68)` (l.3609) → tokens.
- [ ] **4.3** — `stroke='white'` (l.5450), `#f1f5f9` grille SVG (l.5383) → `var(--*)`.
- [ ] **4.4** — Factoriser le conteneur de section + `<h4>` répétés des dizaines de fois → classes `.alflight-card`/`.alflight-card-header` **existantes** ou `tokens.patterns`.

## ♻️ VAGUE 5 — Anti-patterns transverses *(multi-fichiers)*

- [ ] **5.1** — **Texte invisible** (fond=texte) : `ManexViewer.jsx:455-457,475-477` · `PerformanceWizard.jsx:53-54,892-893` → fond `var(--accent-primary)` + texte `var(--text-inverse)`.
- [ ] **5.2** — **Bordure invisible** (fond en bordure) : `PerformanceWizard.jsx:71,76,81` → `var(--border-subtle)` ou couleur d'état.
- [ ] **5.3** — Concaténations `getStatusColor()+'20'` / `confidenceColor()+'20'` : `PilotDashboard.jsx:903,1070` · `ManexExtractionReview.jsx:265` → tokens `--accent-soft` ou rgba maîtrisé.
- [ ] **5.4** — Ternaires de couleur morts : `Step7Summary.jsx:1041` (+ scan global `? 'var(--X)' : 'var(--X)'`).
- [ ] **5.5** — Scan global `color:'var(--app-bg)'` utilisé comme **texte** (noir sur noir) → `var(--text-primary)`.

## 🟥 VAGUE 6 — Rationaliser `#C04534` *(262× / 69 fichiers · itératif)*

- [ ] **6.1** — Lister les **vrais NO-GO** (zones P/R/D `VFRNavigationTable`, masse hors limite, météo VFR impossible) → conserver le rouge.
- [ ] **6.2** — Le reste (expirations `FlightCurrencyTracker`, champs requis vides `SIAReportEnhanced`, erreurs calcul `PerformanceStateMatrix`) → orange/ivoire.
- [ ] **6.3** — Tous les `#C04534` conservés → `var(--color-red-critical)` (jamais en hex).

## 🔤 VAGUE 7 — Campagne `fontSize` *(1801× / 132 fichiers · codemod)*

- [ ] **7.1** — Écrire un codemod (jscodeshift) : hex connus → `var(--…)`, `fontSize:'NNpx'` → token le plus proche.
- [ ] **7.2** — Appliquer par feature, vérifier visuellement, commit par lot.

## 🛡️ GOUVERNANCE — empêcher la régression

- [x] **G.1** — `eslint.tokens.cjs` : règles ajoutées — **noms de couleurs CSS** (`'white'`/`'black'`/`'red'`…) interdits dans les props de couleur + **`fontFamily`** en dur interdit (≠ `var(--font-*)`/`'inherit'`). Testé OK.
- [x] **G.1b** — `lint:tokens` étendu aux **`.ts/.tsx`** : faute de `@typescript-eslint/parser` (non installé → `npm i` éviterait de toucher le `node_modules` partagé), `scripts/lint-tokens.mjs` ajoute un **scan regex dep-free** (hex/rgba) sur `.ts/.tsx`. Comble le gap (l'éditeur ABAC `.tsx` échappait au garde-fou). Testé OK.
- [ ] **G.2** — Pre-commit (⚠️ à brancher au **MERGE** — PAS auto-installé : `.git` (`git rev-parse --git-common-dir` = repo principal) et `node_modules` partagés avec la session parallèle) :
  ```bash
  npm i -D husky && npx husky init
  printf 'npm run lint:tokens:staged\n' > .husky/pre-commit
  ```
- [ ] **G.3** — CI : job `npm run lint:tokens:all` (non bloquant d'abord) → suivre la courbe de dette (~6000 → 0).
- [ ] **G.4** — Quand `lint:tokens:all` = 0 erreur → rendre pre-commit + CI **bloquants**.

> 📌 Exceptions déjà documentées dans le code (→ `// eslint-disable-next-line no-restricted-syntax` quand on les édite) : arcs anémomètre `SpeedLimitationChart`, palette courbes `CurveManager.DEFAULT_COLORS`, `FlightRecapTable`/`PRINT` (artefact PDF, `eslint-disable` fichier déjà posé).

---

### 📌 Ordre conseillé d'exécution
**0 → 1 → 5 → 6 → 2 → 3 → 4 → 7**, gouvernance (G) en continu.
*(La vague 0 + 5 + 6 donne le plus gros gain visuel pour le moins de risque ; 7 est mécanique et se fait en dernier via codemod.)*
