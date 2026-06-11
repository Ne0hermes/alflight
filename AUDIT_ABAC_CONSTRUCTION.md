# AUDIT — Construction des abaques (module ABAC) & conformité charte

> **Date** : 2026-06-11 · **Demande pilote** : « que la construction de toutes les courbes
> de l'abaque — les 3 modèles qui se chevauchent — soit construite en même temps sur la
> même interface » + « l'état graphique de ce module ne semble pas coller à la charte ».
> **Portée** : `src/abac/**` + point d'entrée `Step4Performance` (wizard avion).
> **Statut** : AUDIT seul — aucune modification de code.

---

## 1. Architecture actuelle (état des lieux)

```
AbacBuilder.tsx (~2 900 lignes — orchestrateur, étapes axes/points/final)
  ├─ graphs: GraphConfig[]            ← état GLOBAL multi-graphes (élevé) ✅
  │    ├─ axes, curves[] (→ points[])
  │    └─ linkedFrom[] / linkedTo[]   ← le CHAÎNAGE entre graphes existe ✅ (types.ts:146-147)
  ├─ selectedGraphId                  ← UN SEUL graphe affiché/édité à la fois ❌
  ├─ AbacGraphWizard.tsx (~1 200 l.)  ← mini-wizard PAR graphe : image → position →
  │                                      axes → calibration → courbes (séquentiel strict)
  ├─ AbacCurveManager (manager.ts)    ← gère courbes/points d'UN graphe (1 seule ref) ⚠️
  ├─ GraphManager / CurveManager / Chart / AxesForm / PointsTable / PointEditor
  └─ CascadeCalculator / ChainCalculator + cascade.ts (1 327 l.)
                                      ← calcul en cascade multi-graphes À LA LECTURE ✅
```

**Sauvegarde** : `AbacCurvesJSON { version:'2.0', graphs: GraphConfig[], metadata }` →
`onSave()` → `Step4Performance` → `aircraft.performanceModels[N].data` (tous les graphes
chaînés dans UN modèle) → wizard → Supabase/IndexedDB. Brouillon localStorage strippé
(fitted + dataURL > 5 MB).

**V2 orpheline** : `v2/BezierAbacEditor.jsx` + `AbacEditorDemoPage.jsx` = prototype R&D
(Bézier cubiques + poignées de contrôle, axes SVG fixes 1000×700) **jamais branché** au
flux réel (zéro import hors de v2/). À trancher : source d'inspiration UX (drag de
courbes) ou suppression.

## 2. Flux de construction actuel — la friction

Pour un abaque type décollage (3 graphes chaînés : altitude/température → masse → vent) :

1. Graphe 1 : image (upload PDF/capture) → position (drag + 8 poignées) → axes
   (min/max/pas/unité X-Y + operationId) → calibration (optionnelle, clics graduations)
   → courbes (créer courbe → cliquer les points → TERMINER la courbe avant la suivante).
2. Navigation **◀ ▶ par index** (`subStepGraphIndex`) vers le graphe 2 → tout refaire.
3. Graphe 3 → idem.
4. Liaison des graphes (GraphManager, dropdowns linkedFrom/linkedTo) — **APRÈS COUP**.
5. Étape finale : résumé, validation operationId, save.

**Constats** :
- ~30+ clics et 3 écrans complets ; **jamais deux graphes visibles en même temps** ;
- workflow **séquentiel strict** (impossible d'ajuster le graphe 1 en construisant le 3
  sans perdre son contexte) ;
- **aucune vue d'ensemble de la chaîne** (pas de preview « G1 → G2 → G3 » en édition —
  la cascade visuelle n'existe qu'au CALCUL, pas à la CONSTRUCTION) ;
- la liaison entre graphes est une étape abstraite (dropdowns) déconnectée du dessin.

## 3. Verdict architectural — la bonne nouvelle

| Aspect | État | Note |
|---|---|---|
| Modèle d'état (`graphs[]`) | ✅ PRÊT multi-graphes | état déjà élevé dans AbacBuilder |
| Chaînage (`linkedFrom/linkedTo`) | ✅ PRÊT | add/removeLink existants (AbacBuilder ~l.547-573) |
| Moteur cascade (lecture) | ✅ PRÊT | cascade.ts : méthode des abaques complète |
| Manager de courbes | ⚠️ 1 seule ref | à instancier PAR graphe (ou hook par graphe) |
| **Présentation** | ❌ **MONO-GRAPHE** | 1 Chart visible, navigation par index |

→ **Ce n'est PAS une refonte du modèle de données : c'est une refonte de PRÉSENTATION.**
Le JSON sauvegardé (`AbacCurvesJSON.graphs[]`) ne change pas ; la compat lecture
(CascadeCalculator, perfs en prépa vol) est préservée par construction.

## 4. Proposition — « Atelier abaque » : les 3 graphes côte à côte

**Principe** : un seul écran, 2-3 colonnes (une par graphe de la chaîne), comme l'abaque
papier du MANEX qu'on recopie.

1. **Grille multi-Chart** : chaque colonne = un Chart vivant (image filigrane + axes +
   courbes). Le graphe FOCUS (clic) reçoit les outils d'édition ; les autres restent
   visibles et à jour. Largeur : 3 colonnes en desktop, bascule onglets < 1100 px.
2. **Barre d'outils contextuelle unique** (haut d'écran) : sous-étapes image / position /
   axes / calibration / courbes appliquées AU GRAPHE FOCUS — plus de tunnel séquentiel ;
   on peut revenir au graphe 1 à tout moment sans rien perdre.
3. **Connecteurs visuels de cascade** : entre les colonnes, flèches « sortie Y → entrée
   Y » matérialisant linkedTo ; cliquer un connecteur = éditer la liaison (remplace les
   dropdowns abstraits du GraphManager). Une « ligne de lecture » traverse les 3 graphes
   en survol pour vérifier la cohérence pendant la construction.
4. **Managers par graphe** : instancier un AbacCurveManager par GraphConfig (map
   id → manager) ou refactorer en hook `useCurveManager(graphId)` — seul vrai chantier
   technique identifié.
5. **Test de cascade en direct** : panneau replié « Tester » qui exécute
   performCascadeCalculationWithParameters sur les 3 graphes en l'état — détecte tout de
   suite un chaînage incohérent (au lieu de le découvrir en prépa vol).

**Ce qui ne change pas** : AbacCurvesJSON, cascade.ts, operationCatalog, la sauvegarde
performanceModels, le CascadeCalculator de lecture.

## 5. Conformité charte graphique — verdict : RE-SKIN COMPLET

Le module est **~100 % hors-charte couleurs** et n'importe **jamais** les tokens
(`@shared/styles/designSystem`) ni les variables `var(--bg-*/--text-*)` utilisées
partout ailleurs (réf. conformes : AircraftModule, composants editorial/*).

Inventaire (relevé sur AbacGraphWizard.tsx, AbacBuilder.tsx, AxesForm.tsx,
PointsTable.tsx, styles.module.css — Chart.tsx/PointEditor à confirmer au même motif) :

| Catégorie | Constat | Volume |
|---|---|---|
| Fonds clairs en dur | `background: white` (styles.module.css ×6, AbacGraphWizard ×12, AxesForm:126, PointsTable:18) + pastels Tailwind (#eef2ff, #f3f4f6, #f9fafb, #dbeafe, #ecfdf5…) | ~33 |
| Texte hors palette | hex gris/indigo/ambre (#6b7280, #374151, #312e81, #92400e, #065f46…) — zéro `var(--text-*)` | 40+ |
| CTA hors accent | boutons bleus #3b82f6 / verts #22c55e au lieu de `var(--accent-primary)` #f26921 | 10+ |
| Bordures | #d1d5db / #e5e7eb / #9ca3af au lieu de `var(--border-subtle/regular)` | 20+ |
| ~~MUI thème clair~~ | **FAUX POSITIF** : le ThemeProvider global « Dark Cockpit » (MobileApp.jsx + src/styles/muiTheme.js) couvre déjà les TextField/Select d'AbacBuilder | — |
| Espacements/rayons | px en dur (10px, 4/6px) hors tokens.spacing / tokens.radius | diffus |

**Correction du rapport intermédiaire** : `var(--font-sans)` (styles.module.css:299,326)
n'est PAS une variable inexistante — elle est définie dans `src/index.css:143` et vaut la
pile **Century Gothic** → la typo du CSS module est conforme à la décision « police
unique ». Le vrai sujet typo : vérifier qu'aucun composant TSX n'impose une autre
famille en inline.

**Top corrections par impact** : (1) `white` → `var(--bg-surface)` ; (2) pastels →
`var(--bg-overlay)` ; (3) hex texte → `var(--text-primary/secondary/tertiary)` ;
(4) CTA → orange charte ; (5) bordures → `var(--border-*)` ; (6) StyledTextField/
CustomSelect maison à la place du MUI nu ; (7) rayons/espacements → tokens.

## 6. Plan de remédiation proposé (à valider)

| Phase | Contenu | Effort estimé |
|---|---|---|
| **P0 — Re-skin charte** | passes de substitution (fonds, textes, CTA, bordures) + StyledTextField/CustomSelect sur les 10 composants UI ; AUCUN changement de comportement → livrable indépendant, testable vite | ~8-12 h |
| **P1 — Managers par graphe** | map id→AbacCurveManager (ou hook), suppression du couplage selectedGraphId↔ref unique | ~3-4 h |
| **P2 — Atelier multi-colonnes** | grille 3 Charts (bascule onglets < 1100 px), barre d'outils contextuelle par graphe focus, suppression de la navigation ◀▶ ; **+ drag Bézier recyclé de v2** (façonner une courbe par poignées de contrôle, en complément du clic-points) | ~16-22 h |
| **P3 — Connecteurs de cascade** | flèches linkedTo entre colonnes + édition de liaison au clic + ligne de lecture en survol | ~6-8 h |
| **P4 — Test cascade en édition** | panneau « Tester » branché sur performCascadeCalculationWithParameters | ~3-4 h |
| **P5 — retrait v2** | une fois le drag Bézier recyclé dans l'atelier (P2), suppression du dossier v2/ (l'historique git le conserve) | ~0,5 h |

## 7. Décisions pilote — ACTÉES (2026-06-11)

1. **Disposition** : ✅ 3 colonnes simultanées, bascule en onglets sur écran étroit.
2. **Ordre de livraison** : ✅ P0 (re-skin charte) livré SEUL d'abord — gain visuel
   immédiat, zéro risque fonctionnel — puis P1→P2→P3 en seconde livraison.
3. **v2/BezierAbacEditor** : ✅ RECYCLER le drag Bézier (poignées de contrôle) dans
   l'atelier (intégré à P2, effort revu en conséquence) ; v2/ supprimé ensuite (P5).
4. **Test cascade en édition** : ✅ INCLURE (P4).

**Ordre d'exécution acté : P0 → P1 → P2 (avec Bézier) → P3 → P4 → P5.**

## 8. P0 — EXÉCUTÉE (2026-06-11)

Re-skin appliqué par codemod déterministe (contexte propriété de style uniquement,
palettes de courbes protégées) + passe ciblée sur les motifs dynamiques
d'AbacGraphWizard (factory `btnStyle('#hex')`, ternaires d'état) :

- **104 substitutions** automatiques + 1 manuelle : fonds → `var(--bg-surface/overlay)`,
  textes → `var(--text-*)`, CTA bleus/ambre → `var(--accent-primary)`, états verts →
  `var(--status-success)` (fond doux `rgba(79,174,127,0.12)`), rouges →
  `var(--color-red-critical)`, bordures → `var(--border-subtle/regular)`.
- Couleur de courbe PAR DÉFAUT : `#ef4444` → `#F26921` (1re entrée DEFAULT_COLORS).
- Chart.tsx : ternaire dégénéré `clamped ? '#f26921' : var(...)` → `var(--accent-primary)`.
- **Conservés sciemment** : `color:'white'` sur fonds accent/status (texte sur bouton
  plein), `stroke/fill="white"` du chrome SVG (ligne de lecture, halo de points —
  contraste fonctionnel sur fond sombre), palette DEFAULT_COLORS (couleurs de DONNÉES).
- **Faux positifs corrigés** vs rapport d'agent : `var(--font-sans)` existe
  (index.css:143 = Century Gothic) ; MUI déjà sombre via ThemeProvider global.
- Réalité du périmètre : ~95 % des violations étaient concentrées dans
  **AbacGraphWizard.tsx** + 7 points du CSS module — AbacBuilder/PointEditor étaient
  déjà propres (CSS module conforme). L'estimation 8-12 h venait du rapport d'agent
  surdimensionné ; l'exécution outillée a pris une fraction de ça.
