# AUDIT — Refonte de l'atelier ABAC en « image unique » + désindigestion de l'UI

> **Date** : 2026-06-11 · **Suite de** : AUDIT_ABAC_CONSTRUCTION.md (P0→P5 livrées).
> **Déclencheur** : retour pilote après test en réel de l'atelier P2a/P3 — « les 3
> graphiques ne sont pas mis ensemble », « la photo en filigrane n'est pas à l'échelle,
> tu peux l'enlever », « ce que je voulais : sur LA MÊME IMAGE, positionner les 3
> graphiques », « énormément de tableaux et de sous-tableaux, les étapes et sous-étapes
> ne sont pas claires, ça devient indigeste ».
> **Référence mentale** : l'abaque papier PA-28-181 (décollage 0° volets) — UNE image,
> UN axe Y commun (distance 15 m), TROIS zones X (température / masse / vent).

---

## 1. Constat — l'écart entre l'atelier livré et le modèle mental

L'atelier P2a a mis les graphes « côte à côte » sous forme de **cartes séparées,
chacune avec SA copie d'image** — c'est un alignement de 3 graphiques indépendants.
Or un abaque n'est PAS 3 graphiques indépendants : c'est **UN document** où les 3
zones partagent le même filigrane et le même axe Y. Le pilote recopie un document,
pas trois.

## 2. L'indigestion, chiffrée (inventaire exhaustif, 2026-06-11)

| Métrique (abaque 1 graphe / 4 courbes) | Constat |
|---|---|
| Écrans AVANT le builder | **5** (Step4 récap → PerformanceWizard : type → upload → analyse → pages) |
| Panneaux simultanés dans l'étape « points » | **6+** (bandeau cartes, test cascade, wizard 5 onglets, nav) |
| Sous-étapes par graphe | **5** (image, position, axes, calibration, courbes) — ×N graphes |
| Boutons/actions distincts sur le parcours | **~50**, dont **~15 visibles en même temps** |
| États/modes parallèles | **8+** (editorMode×6, windFilter, expandedGraphs, imageAdjust…) |
| Façons d'éditer un point | **3** (drag Chart, PointsTable, PointEditor†) |
| Façons de sélectionner une courbe | **2** (CurveManager, Chart) |

**Code mort encore présent** (jamais atteignable, mais pèse mentalement et en
maintenance) : case `'axes'` (AbacBuilder ~l.1229), case `'points_legacy_unused'`
(~l.1789), restes d'étape `'fit'`, **GraphManager** (importé jamais monté — remplacé
par les chips P3), **PointEditor** (importé jamais monté). †PointEditor n'est pas
dans le flux mais son code suggère une 3e voie d'édition.

## 3. Cible — l'« Atelier image unique » (modèle PA-28-181)

```
┌─ 1·Image ─ 2·Cadres & axes ─ 3·Courbes ─ 4·Valider ─┐   ← 4 étapes PLATES
│                                                      │
│   Y COMMUN (paramétré 1 fois : min/max/pas/titre)    │
│   ┃ ┌─G1·Température─┐ ┌─G2·Masse─┐ ┌─G3·Vent─┐      │
│   ┃ │   (cadre tiré  │ │  (cadre) │ │ (cadre) │      │
│   ┃ │  sur l'image)  │ │          │ │         │      │
│   ┃ └─X1: -40→30°C───┘ └─X2 (inv)─┘ └─X3: kt──┘      │
│            UNE image MANEX, posée/recadrée 1 fois    │
└──────────────────────────────────────────────────────┘
```

1. **Image** : import + position/recadrage du filigrane — UNE fois, pour tout le set.
   (La photo DISPARAÎT des cartes d'aperçu — demande pilote, elle n'était pas à
   l'échelle.)
2. **Cadres & axes** : on TIRE les cadres des graphes directement sur l'image
   (bandes verticales à poignées). **Y commun saisi une fois** (c'est la définition
   d'un abaque) ; puis X de chaque cadre (min/max/pas, inversion possible —
   ex. masse décroissante). La calibration fine (clics graduations) reste disponible
   par axe, dans la même étape.
3. **Courbes** : tracé cadre par cadre SUR l'image (cadre actif surligné, les autres
   visibles) — clic-points + façonnage Bézier conservés tels quels.
4. **Valider le modèle** : interpolation de tout + test de cascade intégré + save —
   en un geste.

**Liaison implicite** : l'ordre gauche→droite des cadres SUR l'image définit la
chaîne G1→G2→G3 (linkedTo générés automatiquement) — les chips de liaison manuelle
ne servent plus que pour les cas exotiques (multi-feuilles).

## 4. Modèle de données (compatibilité totale en lecture)

- `AbacCurvesJSON.graphs[]` **INCHANGÉ** : chaque graphe garde ses axes complets —
  le Y commun y est DUPLIQUÉ à la sauvegarde. Le moteur cascade, le
  CascadeCalculator et la prépa vol ne voient aucune différence.
- NOUVEAU bloc de ré-édition : `metadata.workshop = { image: {url,x,y,w,h},
  sharedY: AxisConfig(+calibration), frames: [{graphId, xLeftPx, xRightPx,
  xAxis(+calibration)}] }`.
- Anciens modèles (sans `workshop`) : ouverture en mode compat — cadres recréés sans
  image partagée, ré-attachable à la main (cf. décision D4).

## 5. Purge associée (désindigestion)

| Élément | Sort proposé |
|---|---|
| Cases mortes `'axes'`, `'points_legacy_unused'`, restes `'fit'` | SUPPRIMER (~700 lignes) |
| GraphManager, PointEditor (orphelins) | SUPPRIMER |
| PointsTable | À TRANCHER (D2) : utile pour saisir des valeurs EXACTES lues sur le MANEX — proposé : panneau repliable « Points (saisie précise) » du cadre actif, seul tableau restant |
| Photo dans les cartes d'aperçu | SUPPRIMER (demande pilote) — les cartes deviennent de simples pastilles de navigation, voire disparaissent (les cadres sur l'image les remplacent) |
| Sous-étapes Image/Position/Calibration séparées | FUSIONNÉES (étapes 1 et 2 du nouveau flux) |
| Tunnel amont (5 écrans PerformanceWizard) | À TRANCHER (D3) |

## 6. Plan de refonte proposé

| Phase | Contenu | Effort |
|---|---|---|
| **R0 — Purge** | code mort + orphelins + photo des cartes ; zéro changement de comportement | ~2-3 h |
| **R1 — Modèle workshop** | types + état AbacBuilder : image de SET, sharedY, frames[] ; écriture/lecture metadata.workshop ; duplication Y à l'export | ~4-6 h |
| **R2 — Canevas cadres & axes** | rendu de l'image unique + cadres à poignées + règle Y commune + règles X par cadre + calibration intégrée | ~10-14 h |
| **R3 — Courbes sur l'image** | tracé par cadre actif sur le canevas commun (réutilise Chart/clic-points/Bézier reprojetés dans les cadres) | ~8-12 h |
| **R4 — Validation unifiée + compat** | étape 4 (interpoler tout + test cascade + save), ouverture compat des anciens modèles | ~4-6 h |
| **R5 — Tunnel amont** (si D3 = oui) | « Mes modèles + Nouveau » → atelier direct | ~4-6 h |

## 7. Décisions pilote — ACTÉES (2026-06-11)

1. **D1 — Remplacement** : ✅ l'atelier image unique REMPLACE directement l'actuel
   (pas de cohabitation ; les modèles sauvegardés restent lisibles, format inchangé).
2. **D2 — PointsTable** : ✅ UN SEUL tableau survit — panneau repliable « Points
   (saisie précise) » du cadre actif, replié par défaut. PointEditor et tous les
   doublons d'édition sont purgés.
3. **D3 — Tunnel amont** : ✅ INCLUS (R5) — un seul écran « Mes modèles de
   performance » + « Nouvel abaque » qui ouvre directement l'atelier.
4. **D4 — Anciens modèles** : ✅ mode COMPAT ré-attachable — cadres recréés sans
   image partagée, courbes/axes intacts, image ré-attachable à la main.

**Ordre d'exécution acté : R0 (purge) → R1 (modèle workshop) → R2 (canevas cadres
& axes) → R3 (courbes sur l'image) → R4 (validation unifiée + compat) → R5 (tunnel
amont).** Exécution au « lance » du pilote, phase par phase, avec build + commit
sélectif + merge main à chaque phase (pattern de session établi).

## 8. R0 — EXÉCUTÉE (2026-06-11)

- **Cases mortes supprimées** d'AbacBuilder (~1 180 lignes) : `'axes'` (1229-1450),
  `'points_legacy_unused'` + `'fit'` + `'fit_old'` (1789-2745) — gardes-fous de
  frontières vérifiés avant splice.
- **Effet mort retiré** : auto-interpolation `currentStep === 'fit'` (+ état
  `hasAutoInterpolated`) — l'interpolation passe par onFinish → handleFitAll.
- **Type `Step` rétréci** à `'points' | 'final'` ; `steps[]` et `canProceed()`
  alignés ; import d'itération LEGACY remappé (`axes→points`, `fit→final`) au lieu
  de pousser une étape qui n'existe plus.
- **3 composants orphelins SUPPRIMÉS** : GraphManager.tsx, PointEditor.tsx et
  **AxesForm.tsx** (découvert orphelin pendant la purge : seuls les cases mortes le
  montaient ; le wizard a ses propres champs d'axes). Exports index.ts nettoyés.
  CurveManager et PointsTable restent VIVANTS (montés par AbacGraphWizard).
- **Photo retirée des cartes d'aperçu** (demande pilote) : les vignettes du bandeau
  n'affichent plus le filigrane hors-échelle — courbes + axes seuls.
- Bilan net : **−1 670 lignes**, zéro changement de comportement, build vert.

## 9. R1 — EXÉCUTÉE (2026-06-11)

Le modèle de données de l'atelier est posé (fondation silencieuse) :

- **Types** (`core/types.ts`) : `WorkshopImage` (position/taille en pixels inner,
  même convention que BackgroundImage du Chart), `WorkshopFrame` (bande
  `xLeftPx→xRightPx` par graphe + calibration X optionnelle — l'ordre
  gauche→droite définit la chaîne G1→G2→G3), `WorkshopConfig` (image, `sharedY`
  = axe Y COMMUN type `AxisSpec`, calibration Y commune, frames),
  `WorkshopTickCalibration` (équivalent core du tick du Chart).
  `AbacCurvesJSON.metadata.workshop?` ajouté.
- **État AbacBuilder** : `workshop` (défaut : image null, sharedY 0-100, frames
  vides) + dérivé `workshopActive` (image présente OU ≥1 cadre).
- **Chargement** : `initialData.metadata.workshop` restauré s'il existe ; les
  modèles antérieurs n'en ont pas → état par défaut (mode compat D4, les cadres
  seront recréés à l'ouverture du canevas R2).
- **Export** (`handleExportJSON`) : quand `workshopActive`, le **Y commun est
  dupliqué** dans chaque graphe CADRÉ (les graphes hors cadre — multi-feuilles —
  gardent leur Y propre) et `metadata.workshop` est persisté. Quand l'atelier
  n'est pas utilisé : **exports byte-identiques à avant** — zéro changement de
  comportement tant que R2 n'existe pas.

## 10. R2a — EXÉCUTÉE (2026-06-11) · le canevas est à l'écran

**Nouveau composant `WorkshopCanvas.tsx`** (~340 l.) — le geste de l'abaque papier :

- **UNE image pour le set** : import (bouton 📷), pose et recadrage par drag +
  4 poignées d'angle (mode « ✥ Ajuster »), opacité filigrane. Marges réservées
  aux règles d'axes (R2b).
- **Les cadres se TIRENT sur l'image** : bandes verticales pleine hauteur, bord
  orange = cadre ACTIF (focus au clic, pilote les outils du wizard en dessous),
  poignées gauche/droite (redimension), corps draggable (déplacement), ✕ pour
  retirer un cadre (graphe et courbes conservés), bouton « ＋ Ajouter un cadre »
  (cadre le prochain graphe non cadré, sinon crée un graphe).
- **Chaîne G1→G2→G3 AUTOMATIQUE** : flèches dessinées entre cadres ; un effet
  du builder synchronise linkedTo/linkedFrom sur l'ordre gauche→droite des
  cadres (réécrit uniquement les graphes cadrés, et uniquement si changement).
- **Compat D4 opérationnelle** : un modèle d'avant la refonte (graphes sans
  cadres) affiche le bandeau « Créer un cadre par graphe » → cadres équirépartis,
  à recaler sur l'image ré-importée.

**Intégration AbacBuilder/Wizard** :
- Le canevas REMPLACE le bandeau de cartes P2a (vignettes Chart supprimées —
  l'image + les cadres SONT la vue d'ensemble ; R3 y ramènera les courbes).
- Quand l'atelier est actif, les sous-étapes « Image » et « Position » du wizard
  sont MASQUÉES (`hideImageSubSteps`) : l'image vit sur le canevas — le wizard
  démarre sur « Axes » et sa navigation parcourt les sous-étapes visibles.
- Tant que l'atelier n'est pas engagé (pas d'image, pas de cadre), l'ancien flux
  par graphe reste intégralement fonctionnel (filet de sécurité).

**Reste pour R2b** : règle Y commune ÉDITABLE (valeurs/pas/titre/unité) sur le
canevas, règles X par cadre, calibration par clics sur le canevas (Y commun une
fois + X par cadre), retrait des chips manuelles de liaison devenues inutiles.

## 11. R2b — EXÉCUTÉE (2026-06-11) · les axes vivent sur le canevas

- **Panneau « Axes » sous le canevas** : à gauche le **Y COMMUN** (titre, unité,
  min, max, pas, inversé) — paramétré UNE fois, c'est la définition de l'abaque ;
  à droite le **X du cadre ACTIF** (mêmes champs + « inversé », ex. masse
  décroissante). L'axe X reste porté par le GRAPHE (aucun nouveau lieu de
  vérité) ; le Y commun vit dans workshop.sharedY.
- **Règles graduées dessinées** : règle Y à gauche (graduations du pas, lignes
  guides légères quand calibrée), règle X sous CHAQUE cadre (graduations + titre/
  unité + sens), badge « calibré ✓ ».
- **Calibration PAR CLICS sur le canevas** : « 🎯 Calibrer Y » (une fois pour le
  set) et « 🎯 Calibrer X » (par cadre) — bannière guidée valeur par valeur
  (ordre visuel : Y haut→bas, X gauche→droite, sens inversé respecté), overlay
  crosshair qui capture les clics (drags désactivés pendant la session), ↺ Reset
  par axe. Stockage : workshop.yTicks / frame.xTicks (types R1).
- **Sync builder** : le Y commun se PROPAGE en continu aux graphes cadrés
  (cohérence wizard/test cascade/export, réécriture seulement si différence) ;
  dans le wizard, le panneau « Axe Y » devient une VITRINE en lecture seule
  quand l'atelier est actif (« se règle une fois sur le canevas ») — le X y
  reste éditable (même donnée que le panneau du canevas).
- Chips manuelles de liaison : déjà retirées avec le bandeau en R2a (la chaîne
  est automatique par l'ordre des cadres).

**Reste pour R3** : tracé des courbes SUR le canevas (clic-points + Bézier
reprojetés dans le cadre actif, via les mappings value↔pixel de R2b).

## 12. R3 — EXÉCUTÉE (2026-06-11) · les courbes vivent sur le canevas

- **Toutes les courbes de tous les cadres** sont reprojetées sur le canevas
  (mappings value↔pixel R2b, calibration comprise) : trait `fitted` si interpolé,
  polyligne des points sinon, couleurs réelles — cadre actif net, inactifs
  estompés. La vue d'ensemble de l'abaque est désormais L'IMAGE AVEC SES COURBES.
- **Tracé au clic sur le cadre actif** : quand le wizard est en mode
  « placement » (verrou anti-clics-fantômes remonté via `onEditorModeChange`),
  le clic dans le cadre AJOUTE un point (mappings inverses pixel→valeur,
  calibration comprise) — le déplacement du cadre est gelé pendant le tracé.
- **Édition des points sur le canevas** : points de la courbe sélectionnée en
  cercles pleins — GLISSER pour déplacer (drag absolu → valeurs), CLIC DROIT
  pour supprimer ; tooltips avec coordonnées.
- **Réticule de tracé** : lignes pointillées + coordonnées data au survol du
  cadre actif en mode placement.
- Choix assumé : le **façonnage Bézier reste sur le Chart du wizard** (l'éditeur
  fin, avec la table de points) — dupliquer l'état des poignées sur deux surfaces
  créerait deux vérités ; le canevas REFLÈTE le résultat appliqué instantanément
  (même state). Si l'usage réclame les poignées sur le canevas : R3b dédiée.
- Builder : `handlePointClick/Drag/Delete` existants réutilisés tels quels (ils
  écrivent déjà sur graphe focus + courbe sélectionnée) — zéro nouveau lieu de
  vérité.

**Reste** : R4 — validation unifiée (« Valider le modèle » : interpoler tout +
test cascade + save en un geste) + finitions compat ; R5 — tunnel amont.

## 13. R4 + R5 — EXÉCUTÉES (2026-06-11) · LE PROGRAMME EST COMPLET

**R4 — Validation en un geste** (étape finale du builder) :
- Le **test de cascade est intégré à l'écran de validation** (panneau ouvert par
  défaut, même CascadeCalculator) : on vérifie le modèle complet (entrée → G1 →
  G2 → G3 → résultat) AVANT d'enregistrer, sans changer d'écran. L'interpolation
  de toutes les courbes se fait déjà à l'entrée de l'étape (onFinish → fitAll).
- Le bouton final dit ce qu'il fait : « **✓ Valider et enregistrer le modèle** »
  (ex-« Suivant »).

**R5 — Tunnel amont court-circuité** :
- L'écran récapitulatif « Mes modèles » (Step4Performance) a un bouton dédié
  « **➕ Nouvel abaque — atelier image unique** » → ouverture DIRECTE de
  l'atelier (PerformanceWizard saute à l'étape builder via
  `initialData.directToBuilder`) : l'image s'importe sur le canevas — fini le
  tunnel type → upload → analyse → pages pour les abaques.
- « Ajouter des données de performance » reste pour les TABLEAUX MANEX
  (extraction IA) et les flux mixtes — ce chemin n'est pas touché.
- Le chemin « Modifier » un abaque existant sautait déjà au builder (inchangé).

### Bilan du programme R0→R5
| Phase | Commit | Livré |
|---|---|---|
| R0 | 2d83127 | purge code mort (−2 511 lignes brutes), orphelins, photo des aperçus |
| R1 | d2683e3 | modèle workshop (image de set, Y commun, cadres) + persistance |
| R2a | 787ebee | canevas : image unique + cadres à poignées + chaîne auto |
| R2b | 903238b | axes sur canevas : Y commun, X par cadre, calibration aux clics |
| R3 | a5abed2 | courbes sur le canevas : tracé au clic, drag, suppression, réticule |
| R4+R5 | (ce commit) | validation+test en un geste, tunnel amont direct |

La vision pilote (PA-28-181) est en place de bout en bout : **une image, un Y
commun, des cadres, des courbes — et un modèle validé sans quitter le canevas.**

## 14. R6 — Suppression du wizard résiduel (2026-06-12, retour pilote post-livraison)

**Déclencheur** : en testant l'atelier, le pilote bute sur le bloc sous le
canevas (« à quoi sert tout ce bloc ? ») — c'était l'ancien wizard 5
sous-étapes affiché EN ENTIER sur un nouvel abaque (l'atelier n'étant « actif »
qu'après import d'image, le filet de sécurité R2a montrait tout le legacy :
double import d'image, double « ajouter un graphique », 5 étapes redondantes).
Découverte au passage : la sous-étape 1 (Identité — rôle + operationId) était
**masquée dès que l'atelier était actif** (R2a) → rôle/opération INACCESSIBLES
en flux atelier alors que le verrou d'export les exige. R6 corrige les deux.

**Livré** :
- **`GraphIdentityPanel.tsx` (nouveau)** — l'identité (rôle primaire/
  intermédiaire, position cascade, opération canonique, nature de sortie)
  extraite du wizard en composant réutilisable.
- **Builder** : l'identité du CADRE ACTIF vit sous le canevas (visible dès
  qu'un cadre existe) + bouton « 🗑 Supprimer ce graphique (et son cadre) »
  (le ✕ d'un cadre ne fait que dé-cadrer ; l'ancien bouton supprimer vivait
  dans la barre de pagination disparue). Handler `updateCurrentGraph` hissé
  (auto-sync systemType conservé).
- **Wizard : nouveau mode `atelierMode`** — ne rend QUE l'outillage courbes :
  bandeaux contextuels (placement / Bézier / édition), Chart (surface Bézier),
  CurveManager, et la table de points en **panneau repliable fermé par défaut**
  (« 📋 Points (saisie précise) » — D2 enfin au format voulu). Plus de barre
  « Graphique 1/N », plus de sous-étapes, plus d'import d'image par graphe,
  plus de « + Ajouter un graphique » (doublon du « ＋ Ajouter un cadre »).
  Pied réduit au seul geste de sortie « 🪄 Interpoler & Valider → » (unique
  chemin vers l'étape finale — préservé).
- **Progressive disclosure** : tant qu'aucun cadre n'est posé, RIEN sous le
  canevas (ni identité, ni test cascade, ni wizard) — le canevas guide (image
  puis cadres). Anciens modèles : bandeau compat D4 « Créer un cadre par
  graphe » = passage obligé (1 clic, non destructif).
- Import `operationCatalog` du wizard devenu orphelin → retiré.

**Vérification** : tsc parse-clean (0 × TS1xxx) ; build vert (41,5 s) ;
**rendu réel dans le navigateur** (dev server + montage isolé des composants) :
identité rendue, titre « Courbes du cadre actif », bouton « Interpoler les 3
graphiques & Valider » présent, barre de sous-étapes et pagination ABSENTES,
charte sombre respectée (capture vérifiée).

**Différé** : le flux legacy complet du wizard (5 sous-étapes hors atelier)
n'est plus monté nulle part mais reste dans le fichier — purge finale quand
l'atelier aura tourné quelques semaines (avec CurveManager/PointsTable/Chart
qui, eux, restent vivants en atelierMode).
