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

## 15. R7 — Le Chart séparé disparaît : Bézier sur le canevas (2026-06-12, retour pilote)

**Déclencheur** : « cet élément est inutile… il faut que je puisse poser et
prendre la courbe directement sur l'atelier… il faut que je puisse suivre les
traits, donc tout doit se passer sur le graphique avec les 3 zones. » Le Chart
800×800 du wizard réduit (gardé en R3 comme surface Bézier) montrait la courbe
SANS l'image — impossible d'y suivre les traits du MANEX. La décision R3
« Bézier assumé sur le Chart » est CADUQUE : c'est la R3b, exigée par l'usage.

**Livré** :
- **WorkshopCanvas** : nouvelle couche Bézier — preview de la courbe façonnée
  (cubiques) + poignées cp1/cp2 tirables PAR-DESSUS l'image dans le cadre
  actif, lignes guides, ancien trait estompé en pointillés pendant la session
  (pas de double trait ambigu). Drag par le pattern pointer unifié existant,
  coords data via les mappings inverses (calibration comprise). Props :
  `bezierSegments` + `onBezierHandleDrag`.
- **AbacBuilder** : la session Bézier vit ici (`bezierSession` : courbe +
  overrides), segments recalculés en continu (les points restent déplaçables
  pendant la session), `applyBezierSession` échantillonne 6/segment → points
  ordinaires (pipeline inchangé), abandon auto si changement de courbe/cadre/
  étape. Moteur core/bezier.ts P2b réutilisé tel quel.
- **Wizard (atelier)** : le Chart n'est PLUS rendu (il reste pour le flux
  legacy) ; la bannière Bézier pilote la session du builder (Appliquer/Annuler
  externes), « Affiner en Bézier » démarre la session sur le canevas, textes
  adaptés (« directement sur l'image »).

**Vérification** (montage réel navigateur, serveur dev) : couche Bézier rendue
(2 segments → 4 poignées), preview tracée, ancien trait estompé, **drag de
poignée simulé → onBezierHandleDrag reçoit des coords DATA correctes**
(−8.8 °C / 2353 ft) ; wizard : Chart absent (0 svg), « Affiner en Bézier » →
session builder, bannière atelier, Appliquer/Annuler externes câblés. tsc
parse-clean, build vert. Capture : poignées sur le cadre actif, charte sombre.

**Le wizard atelier n'est plus qu'une boîte à outils** : bannières d'état,
CurveManager, table de points repliable, bouton Interpoler & Valider — zéro
surface de dessin hors canevas. La vision « tout sur le graphique » est tenue.

## 16. R8 — Variables canoniques + unités verrouillées + panneau au-dessus (2026-06-12, retour pilote)

**Déclencheur** : « le titre et les unités sont rentrés manuellement, y compris
pour le Y — dangereux puisque ce sont des éléments paramétrants : la
température vient des METAR, la masse du module M&C, le vent des données
météo. Il faut des unités fixes identifiables/réutilisables. » + « mets cet
élément au-dessus de l'atelier ». Constat aggravant : les saisies réelles du
pilote (« temperature », « distance ») ne matchaient AUCUN id du catalogue
`axisVariables` → la cascade n'aurait jamais branché ces axes sur les données
vivantes. Le danger était réel, pas théorique.

**Livré** :
- **`VarSelectMini`** (canevas) : le Titre devient un SELECT de variables
  canoniques (catalogue `core/axisVariables`, groupé par catégorie, filtré
  X = inputs / Y = outputs — même logique que l'AxisVariableSelect de
  l'ancienne sous-étape). La valeur stockée est l'`id` stable (clé persistée
  référencée par les calculs de perf). Valeurs legacy non canoniques :
  préservées, affichées « ⚠ … (legacy) » avec libellé et bordure rouges.
- **`UnitFieldMini`** : l'unité est VERROUILLÉE sur le catalogue — select
  fermé sur `units[]` si plusieurs unités compatibles (°C/°F, m/ft, kt/km/h…),
  badge fixe sinon ; champ libre uniquement pour 'custom' et legacy. Choisir
  une variable pré-remplit son `defaultUnit`.
- **Panneau AXES déplacé AU-DESSUS du canevas** (sous la barre d'outils) :
  on règle les axes avant de regarder l'image, l'ordre de lecture suit le flux.
- **Règles graduées** : affichent le LABEL humain (`getAxisVariableLabel`)
  au lieu de l'id technique.
- **Builder** : auto-détection « graphique vent » restaurée quand l'X devient
  une variable famille vent (isWindRelated, comme l'ancienne sous-étape).

**Vérification** (montage réel navigateur) : panneau AVANT le <svg> dans le
DOM ; Y propose les outputs (distance 50ft…) et PAS l'OAT ; legacy
« distance » signalé ⚠ ; choisir OAT sur X → `onUpdateGraphXAxis(title:'oat',
unit:'°C')` automatique ; unités fermées (°C/°F, m/ft) ; zéro champ texte
libre avec variables canoniques ; labels humains sur les règles. tsc
parse-clean, build vert, capture conforme charte.

## 17. R9 — Identité compacte, sans icônes, repliable, au-dessus de l'atelier (2026-06-12, retour pilote)

**Déclencheur** : « travaille cet élément graphique pour le rendre plus
compact, retirer les icônes et mets-le au-dessus de l'atelier. Rends la zone
réductible. »

**Livré** :
- **GraphIdentityPanel réécrit en version dense** : rôle sur UNE ligne
  (radios inline « Primaire — valeur finale » / « Intermédiaire — correction »,
  descriptions passées en infobulles), position cascade sur la même ligne pour
  les intermédiaires, opération canonique sur une ligne (label court + select),
  ligne d'info ID/Phase/Flaps réduite. AUCUNE icône (🏷⭐🔗🔒🗑 supprimées,
  bouton supprimer inclus).
- **Zone repliable `<details>` AU-DESSUS de l'atelier** (avant le canevas,
  après l'en-tête avion/set). Résumé d'une ligne toujours visible :
  « Identité du graphique N — Primaire · {opération} » ou « Intermédiaire ·
  tableau K ».
- **Ouverture intelligente** : bordure et mention rouges « opération canonique
  à choisir » + zone OUVERTE tant que le primaire n'a pas d'operationId ;
  **se replie automatiquement au choix de l'opération** (transition du prop
  `open` géré par React) ; clé par graphe → l'état se réévalue à chaque
  changement de cadre. Le bouton « Supprimer ce graphique (et son cadre) »
  vit dans le contenu replié.

**Vérification** (AbacBuilder COMPLET monté en navigateur avec initialData
workshop) : zone présente avant « Atelier — image unique » dans le DOM,
ouverte sans opération avec l'alerte, AUCUNE icône, choix de l'opération →
repli automatique + résumé « Primaire · Distance décollage — passage 15 m
(50 ft) » + nom du set auto-synchronisé dans l'en-tête. tsc parse-clean,
build vert, capture de l'écran complet conforme (l'ordre de lecture suit
désormais le flux : identité → axes → image/cadres → courbes → validation).

## 18. R10 — Validation finale : graphes repliés, cascade côte à côte, double unité (2026-06-12, retour pilote)

**Déclencheur** : « à l'étape 3 validation finale, réduire les graphiques
(les mettre en réduction) ; les petits graphiques qui extrapolent les
résultats doivent être les uns à côté des autres pour suivre les tracés ;
et dans la valeur finale, transposer systématiquement entre parenthèses
l'unité opposée (pieds ↔ mètres) pour toujours avoir un comparatif. »

**Livré** :
- **Aperçus des graphes REPLIÉS par défaut** (étape finale, AbacBuilder) :
  un `<details>` « Graphiques du set (N) — courbes interpolées » ; dépliés,
  les cartes se posent côte à côte (flex wrap, max 340 px).
- **CascadeCalculator — étapes CÔTE À CÔTE** : chaque étape devient une carte
  de largeur fixe (396 px), posées en ligne gauche → droite avec une **flèche
  orange entre les cartes** — la lecture suit le tracé d'un graphe au suivant
  comme sur l'abaque papier ; retour à la ligne auto sur écran étroit.
  Le `maxWidth: 800px` du conteneur (qui forçait l'empilement) est levé.
- **Comparatif d'unités systématique** : `formatOppositeUnit(value, unit)`
  (exporté, testable) — ft↔m, kt↔km/h, km↔NM, ft/min↔m/s, kg↔lb, L↔gal,
  lookup insensible à la casse. La valeur finale affiche « 1686.67 ft
  **(514 m)** » ; unité inconnue → pas de parenthèse (pas de fausse conversion).

**Vérification** (CascadeCalculator monté en réel, chaîne 2 graphes liés avec
courbes interpolées, calcul lancé via l'UI) : conversions exactes (2000 ft →
610 m ; 813 m → 2667 ft ; 100 kt → 185 km/h ; unité inconnue → null), deux
cartes sur la MÊME ligne (tops identiques) avec flèche, bandeau final
« 1686.67 ft (514 m) » (514,1 m exact). Leçon au passage : la 1re passe avait
validé le flex sans voir que maxWidth 800 forçait le wrap — la CAPTURE a
montré l'empilement, d'où le fix conteneur. tsc parse-clean, build vert.

## 19. R11 — Test de référence PA-28 faux : 2968 ft au lieu de 1900 (2026-06-12)

**Déclencheur** : test pilote sur F-GNAM (PA-28-181, décollage 50 ft) — PA
2000 ft, OAT 21 °C, vent de face 15 kt, masse 1089 kg. Référence papier :
**1900 ft**. L'app : **2968 ft** (+56 %).

**Diagnostic (reproduction exacte en rejouant le moteur sur le JSON réel)** :
QUATRE causes conspirent —
1. **Sélecteur de vent resté sur « toutes »** (défaut UI) → le moteur a
   interpolé entre « tailwind 1 » et « Headwind 2 », deux familles
   physiquement OPPOSÉES. C'est le chemin exact du 2968.
2. **Guides plus courts que le panneau** : « Headwind 1 » tracé jusqu'à
   11,7 kt pour un X cible de 15 kt → `findYForX` rendait null (tolérance
   10 %) → un « fallback par paramètre » comparait alors 15 kt aux NUMÉROS
   de famille des courbes (1, 2, 3…) → valeurs plausibles mais fausses
   (1417 ft en vent de face).
3. **Heuristique xRef « masse ⇒ entrer à droite »** (codée en dur sur un
   modèle historique, comme l'ex-facteur 1.914 du fix J) : l'entrée d'un
   panneau de correction doit se faire sur sa LIGNE DE RÉFÉRENCE (bord
   visuel GAUCHE — cf. papier : « ligne de référence 2550 lb », « ligne de
   référence vent nul »).
4. **Données : panneau MASSE tracé en MIROIR** — sur le papier l'axe va de
   ~1150 kg (gauche) à ~950 (droite) ; le graphe a été déclaré [950..1150]
   NON inversé, sans calibration X → 1089 kg étaient lus à ~1011 kg.

**Fixes moteur (`core/cascade.ts`)** :
- xRef = bord de la ligne de référence : `xAxis.reversed ? xMaxCommon :
  xMinCommon` (heuristique isMassGraph supprimée).
- `findYForX(curve, x, extrapolate)` : extrapolation FRANCHE du dernier
  segment aux croisements (comme au crayon jusqu'au bord du panneau), signalée
  dans `curveUsed` (« guide(s) prolongé(s) hors tracé »).
- GARDE familles de vent : un graphe vent avec courbes face ET arrière sans
  direction choisie → calcul REFUSÉ avec message explicite (jamais
  d'interpolation mixte silencieuse). Doublé côté UI : blocage avant calcul +
  mention rouge « Direction obligatoire » sous les boutons.
- « Fallback par paramètre » supprimé ; purge des debugs « Y=870 » résiduels.

**Fix données** : `scripts/fix-fgnam-mass-mirror.js` (dry-run par défaut,
`--confirm` à lancer par le pilote) — miroir x′ = 2100 − x sur points +
fitted du graphe masse, `xAxis.reversed = true` → le rendu sur l'image reste
identique, les valeurs deviennent physiques.

**Validation (rejeu du cas réel, moteur fixé)** :
| Scénario | Résultat |
|---|---|
| données actuelles (miroir non réparé), face | 1638 ft (toujours faux → script requis) |
| données réparées, face | **1988 ft** (2722 → 2444 → 1988) |
| données réparées, sans direction | refus explicite ✓ |
| papier | 1900 ft |

Écart résiduel **+4,6 %** = précision du tracé (numérisation des courbes),
côté conservateur. Affinable en retraçant le panneau 1 (2722 ft à 21 °/2000 ft)
et en prolongeant les guides vent jusqu'à 15 kt.

**Leçon** : le moteur de cascade restauré (P4) contenait encore des hacks
calés sur UN jeu de données historique (xRef masse, fallback paramètre,
debugs 870). Tout test de référence MANEX qui diverge doit être rejoué au
JSON réel — la chaîne de reproduction (Supabase → replay navigateur →
logs moteur) est désormais rodée.

## 20. R12 — Extrapolation sous/au-dessus de l'enveloppe : décalage préservé (2026-06-12)

**Déclencheur** : question pilote — « que se passe-t-il si une valeur se situe
en dessous de la première courbe ? » (ex. 10 °C, PA 500 ft, 1100 kg, face
4 kt).

**Réponse vérifiée (rejeu réel, modèle masse réparé en mémoire)** : le moteur
gère ce cas par **décalage vertical constant** — il suit le guide le plus
proche EN PARALLÈLE (le geste du crayon), et l'étiquette « En dessous de la
courbe "Headwind 1" (extrapolation) » apparaît dans la carte d'étape.
Cas pilote : 1823 (interpolé 0ft/1000ft pour PA 500) → 1664 (masse, ratio
0.15) → **1579 ft**.

**Trou trouvé et corrigé en répondant** : si l'entrée est hors enveloppe ET
que le guide le plus proche s'arrête avant le X cible (ex. face 15 kt avec
« Headwind 1 » tracé jusqu'à 11,7 kt), `findYForX` sans extrapolation rendait
null → un fallback renvoyait la valeur DU guide, **décalage perdu** : 1418 au
lieu de 1307. Sous l'enveloppe l'erreur est conservatrice par chance ;
AU-DESSUS elle sous-estimerait la distance (non conservateur, dangereux).
Fix : extrapolation franche (`findYForX(..., true)`) aux deux lectures de la
branche above/below — le décalage est maintenu au-delà du bout du guide.

**Validation** : cas limite 15 kt sous enveloppe = **1307 ft** (≈ calcul
manuel 1308) avec étiquette correcte ; cas pilote 4 kt inchangé (1579) ;
non-régression R11 inchangée (1988). Build vert.

## 21. R13 — Banc de test permanent (2026-06-12, décision pilote)

**Déclencheur** : « si je te donne les valeurs de référence d'exemple et le
résultat attendu, est-ce que ça peut affiner la précision ? » → réponse en 3
niveaux (banc de test / diagnostic par panneau / ajustement automatique des
courbes). Décision : « on va implémenter uniquement le banc de test
permanent » — PAS d'ajustement automatique (avec un seul cas ce serait du
maquillage du résultat, le genre de bidouille purgée en R11).

**Livré** :
- **`metadata.referenceCases`** (types.ts) : cas = entrées d'un exemple du
  manuel (valeur d'entrée + paramètre par graphe + direction de vent) +
  résultat attendu + tolérance (défaut 5 %). Persisté DANS le modèle.
- **`core/referenceBench.ts`** : rejoue les cas sur les graphes EN L'ÉTAT
  (même chaîne que le calculateur, console moteur silencée), verdict
  pass/fail/error avec écart % ; paramètre manquant (graphes modifiés) →
  erreur explicite, jamais silencieuse.
- **`ReferenceCasesPanel`** (écran de validation) : tableau des cas avec
  badge PASS/FAIL/ERREUR recalculé à chaque venue, écart vs tolérance,
  double unité (R10) sur le calculé, suppression par cas ; formulaire
  d'ajout dont les champs suivent la chaîne réelle (labels canoniques R8),
  direction de vent obligatoire si graphe vent.
- **Capture en un clic** : après un calcul réussi du CascadeCalculator,
  « 📌 En faire un cas de référence » reprend les ENTRÉES dans le formulaire
  du banc — le pilote ne tape que le résultat ATTENDU lu sur le papier
  (jamais le calculé : le banc doit tester, pas s'auto-confirmer).
- **Garde à l'enregistrement** : « ✓ Valider et enregistrer » rejoue le banc ;
  s'il y a des échecs, confirm détaillé (« calculé 1988 pour 1700 attendu,
  écart 17 % > ±5 % — Enregistrer quand même ? »). Non bloquant dur : le
  pilote juge, mais il est IMPOSSIBLE d'enregistrer sans le voir.

**Vérification (modèle F-GNAM réel réparé, navigateur)** : moteur du banc —
cas POH (attendu 1900) = PASS à 4,6 % ; cas serré (1700) = FAIL à 17 % ;
cas au paramètre manquant = ERREUR avec message ; panneau rendu avec les 3
badges + résumé « 1/3 OK » ; intégration builder complète — panneau présent
sur l'écran de validation (« 1/2 OK · 1 en échec »), clic Valider → confirm
détaillé → annulation = PAS d'enregistrement ; circuit capture : calcul réel
dans le calculateur → bouton 📌 → formulaire pré-rempli (21/2000/1089/15,
attendu vide). tsc parse-clean, build vert.

**Différé (si le besoin se confirme)** : diagnostic par panneau assisté
(niveau 2) et ajustement borné des courbes sur plusieurs cas (niveau 3,
toujours en proposition à valider courbe par courbe).

## 22. R14 — Le trait suit le point : interpolation invalidée à la retouche (2026-06-12)

**Déclencheur** : « quand je rouvre un abaque déjà pointé et que je bouge un
point, le point rouge bouge mais la courbe reste figée — normal ? » Non :
le rendu du canevas dessine en PRIORITÉ l'interpolation (`curve.fitted`,
calculée à la dernière validation), et les trois handlers de points
(ajout/déplacement/suppression) modifiaient `points` SANS invalider
`fitted` → trait fantôme figé sur l'ancienne forme.

**Fix** : toute retouche de point pose `fitted: undefined` sur la courbe
touchée (les 3 handlers, partagés par le canevas, le Chart legacy et la
table de points). Le trait retombe sur la polyligne VIVANTE des points
(suit le drag en direct) ; la validation ré-interpole tout (onFinish →
fitAll) et le banc de test R13 re-vérifie derrière — boucle cohérente.
Le façonnage Bézier invalidait déjà (R7).

**Vérification (builder réel monté, modèle F-GNAM, drag au pointeur)** :
30 traits interpolés avant → 29 après le drag d'un point : EXACTEMENT la
courbe retouchée devient polyligne et suit le point, les autres restent
interpolées. tsc parse-clean, build vert.

## 23. R15 — Disclaimer performances en préparation de vol (2026-06-12, demande pilote)

**Demande** : afficher dans l'onglet Performance de la préparation de vol que
l'application s'autorise une marge d'erreur de 5 % par rapport aux exemples du
MANEX, et que le commandant de bord reste toujours responsable de la reprise
des performances en cas de doute.

**Livré** : bandeau ⚠️ en tête de Step5Performance (flight-wizard), charte
orange : « Marge de précision — … marge d'erreur de ±5 % par rapport aux
exemples de référence du manuel est assumée. Le commandant de bord reste seul
responsable de la détermination des performances — en cas de doute, reprenez
le calcul sur les abaques officiels du MANEX. » Le 5 % fait écho à la
tolérance par défaut du banc de test R13.

**Vérification** : Step5Performance monté en réel sous FlightSystemProviders
(le composite officiel des contextes) — bannière rendue avec le
PerformanceModule complet derrière (« rendu OK »), textes exacts vérifiés.
Build vert.

## 24. R16b — La valeur de famille devient structurée + unités sur le calculateur (2026-06-12)

**Demandes pilote** : (a) « le nom que j'écris ne sert à rien, je préfère une
liste déroulante… ce qui sécurise les choses » ; (b) « il n'est pas noté
l'unité » sur les entrées du calculateur en cascade (écart inexpliqué 533 ft
rapporté — non reproduit moteur : 2210 ft avec les mêmes entrées sur F-GNAM ;
de plus les deux attendus papier 1860@8kt < 1900@15kt sont physiquement
contradictoires entre eux → re-vérification papier demandée).

**Livré** :
- **Moteur (3 résolveurs : paramétrique, encadrement X-pour-Y, altitude du
  1er graphe)** : priorité à `Curve.familyValue` (valeur STRUCTURÉE), parsing
  du nom relégué en repli de compatibilité. Plus AUCUN écartement muet :
  courbe sans valeur résoluble → console.warn nominatif ; repli « première
  courbe » du résolveur altitude → warning « résultat potentiellement faux ».
- **GraphIdentityPanel** : « Variable de famille des courbes » — liste
  déroulante CANONIQUE (catalogue axisVariables, entrées X), avec unité
  affichée. La déclarer fait apparaître le champ valeur par courbe (déjà
  présent dans CurveManager, badge « ⚠ requis »).
- **CurveManager : « Déduire des noms »** — migration douce : pré-remplit
  familyValue des courbes existantes depuis leurs noms (même regex que le
  repli moteur), le pilote vérifie les badges.
- **CascadeCalculator : unités partout** — libellés humains canoniques +
  unité en gras sur la valeur d'entrée et chaque paramètre (« Composante de
  vent (kt) », « Masse (kg) ») ; le champ altitude affiche la famille
  déclarée ou, à défaut, « même échelle que les courbes : 0ft, 1000ft… » ;
  le placeholder ambigu « ft ou m » est supprimé.

**Vérification (navigateur)** : moteur — 2 courbes aux noms ILLISIBLES avec
familyValue 0/4000 → « Interpolé entre Niveau mer et Plafond pratique » =
2500 (exact main-calc) ; sans familyValue → repli premier-courbe AVEC warning
visible ; calculateur : (°C)/(kg)/(kt) + « Composante de vent » affichés,
« ft ou m » disparu ; sélecteur famille rendu ; « Déduire des noms » remplit
0/1000/2000/3000 depuis les courbes F-GNAM réelles. Build vert.

## 25. R17 — Volets dans la dénomination + création de courbe par valeur (2026-06-12)

**Déclencheurs pilote** : (1) le 533 ft EXPLIQUÉ par le pilote et CONFIRMÉ en
base — F-GNAM porte DEUX modèles strictement identiques (« Distance décollage
— passage 15 m (50 ft) », systemType takeoff_50ft, tracés à 08:19 et 08:53)
qui ne diffèrent que par l'état des volets : le calcul pioche le mauvais.
(2) Rejet du champ valeur libre de R16b : « je préfère une liste déroulante
des altitudes disponibles, 0 → 10 000 par 500 ft, et l'élément choisi devient
le nom de la courbe ».

**Livré** :
- **Catalogue** : 4 variantes volets au décollage (takeoff_{ground_roll,50ft}_
  flaps_{up,to}) ; les ids hérités sans volets restent valides mais étiquetés
  « volets non précisés — hérité ».
- **Identité du graphe : TROIS listes déroulantes** Phase / Métrique / Volets
  qui RÉSOLVENT l'operationId (décomposition mécanique du catalogue) ; une
  opération héritée sans volets s'affiche en rouge « précise les volets ».
- **Verrou anti-doublon sémantique** (Step4Performance, à l'enregistrement) :
  deux modèles d'un même avion ne peuvent plus partager silencieusement le
  même systemType — confirm explicite, et en cas de refus le nom porte le
  marqueur « ⚠ DOUBLON — préciser les volets » (le travail n'est jamais perdu).
- **Capsule « Nouvelle courbe » : création par VALEUR** — famille altitude →
  liste 0..10 000 / 500 ft ; autres familles → saisie numérique avec unité ;
  graphe vent → direction (Face/Arrière) en plus ; le NOM naît de la valeur
  (« 2000 ft », « Face 5 kt ») et familyValue est posé À LA CRÉATION
  (handleAddCurve étendu). Le nom libre ne survit que sans variable de famille.

**Vérification (navigateur)** : identité — 4 selects, legacy signalé rouge,
choisir Volets TAKEOFF résout `takeoff_50ft_flaps_to` ; capsule altitude —
21 valeurs, choisir 2000 crée « 2000 ft » avec familyValue 2000 ; capsule
vent — création « Face 5 kt » fv=5 OK (le harnais synthétique n'a pas réussi
à piloter le select de direction vers Arrière — code React standard identique
aux selects voisins qui répondent ; à confirmer d'un clic réel). Build vert.

**Reste à faire PILOTE après merge** : ouvrir chacun des deux modèles F-GNAM
et préciser les volets (UP pour l'abaque 0°, TAKEOFF pour le 25°) via les
trois listes — les dénominations divergent alors et le verrou cesse d'alerter.

## 26. R18 — Modèle volets TAKEOFF : Y en mètres mal étiqueté + miroir masse (2026-06-12)

**Déclencheur** : test pilote sur le 2ᵉ modèle F-GNAM (Flaps TAKEOFF, qu'il a
déjà différencié via les listes R17 — takeoff_50ft_flaps_to ✓) : 21 °C /
PA 2000 / 1089 kg / vent de face → attendu 1860 ft (567 m), app : 468 ft.

**Diagnostic (extraction + rejeu du modèle 2 — jamais rejoué jusqu'ici, les
replays prenaient le premier modèle trouvé)** :
1. **Axe Y calibré sur l'échelle MÈTRES du papier** (graduations 300 → 1000,
   yTicks le confirment) **mais déclaré « ft »** : les valeurs du modèle SONT
   des mètres étiquetés pieds.
2. **Panneau masse à nouveau tracé en MIROIR** (axe [950..1150] non inversé,
   guides descendants avec la masse) — même piège que le modèle volets 0° (§19).
3. Le vent du test (coupé dans la dictée) déduit = **15 kt** : l'état actuel
   rejoué donne ≈468 à 15 kt (534 à 8 kt) — reproduction exacte.
4. **La « contradiction » des attendus d'hier N'EN ÉTAIT PAS UNE** : 1900 ft
   à 15 kt = tableau volets 0°, 1860 ft à 15 kt = tableau volets TAKEOFF.
   Deux tableaux différents — précisément le défaut de dénomination que R17
   vient de corriger. Mea culpa au pilote.

**Fix données** : `scripts/fix-fgnam-flapsto-y-m-mass-mirror.js` (dry-run OK,
--confirm pilote) — étiquettes Y ft → m (valeurs INCHANGÉES, ce sont des
mètres : 3 graphes + sharedY + outputUnit primaire) + miroir masse
(x′ = 2100 − x, reversed=true, rendu image identique).

**Validation (rejeu, réparations en mémoire)** : 21°/2000/1089/face 15 →
**551 m vs 567 m papier (−2,8 %)** ; à 8 kt : 626 m. Légèrement non
conservateur (−2,8 %) mais dans la tolérance banc (5 %) — affinable au tracé.

**Observations moteur pour plus tard (non corrigées à l'aveugle)** :
- la « plage X commune » qui sert de référence d'entrée est RÉTRÉCIE par les
  guides courts (ici « 11 » s'arrête à 1090 kg → référence prise à ~1090 au
  lieu du bord ~1145). Sur ce cas précis l'effet est neutre/favorable, mais
  le principe « référence = bord du panneau, guides courts extrapolés »
  serait plus fidèle au papier — à instruire avec le pilote sur un cas qui
  discrimine.
- PISTE DE GARDE atelier : avertir quand un panneau de famille « masse » a
  des guides DÉCROISSANTS avec la masse sur un axe non inversé (le miroir a
  eu lieu DEUX fois sur deux modèles) ; et afficher côte à côte les deux
  échelles (m/ft) du papier au moment de calibrer Y.

## 27. R19 — Comparaison live avec la valeur papier dans le calculateur (2026-06-12)

**Demande pilote** : « pouvoir ajouter la valeur de sortie pour qu'elle soit
comparée en live avec la valeur du test — voir le pourcentage d'erreur et
corriger les courbes si nécessaire. »

**Livré** (CascadeCalculator) :
- Champ « **Valeur attendue du papier** (optionnel — unité du Y final) »
  parmi les entrées du test.
- Sur le résultat : pastille **live** « Papier : 567 m · écart −2,8 % »,
  verte si |écart| ≤ 5 % (tolérance du banc), rouge sinon, avec le sens
  explicité (calcul AU-DESSUS / EN DESSOUS du papier). L'écart se recalcule
  à chaque « Calculer » — on retouche une courbe, on recalcule, on voit.
- **📌 « En faire un cas de référence » emporte l'attendu** : le cas du banc
  naît complet (entrées + attendu papier), zéro re-saisie.

**Vérification (modèle volets TAKEOFF réel réparé, navigateur)** : saisie
21/2000/1089/15/face + attendu 567 → « Papier : 567 m · écart −2.8 % ✓ dans
la tolérance (±5 %) » en vert ; le snapshot 📌 contient {expected: 567,
computed: 551}. Build vert.

## 28. R20 — statement_timeout à l'enregistrement : aircraft_data obèse (2026-06-15)

**Déclencheur** : `addAircraft` → `submitPreset` → `updateCommunityPreset`
échoue avec Postgres `57014 canceling statement due to statement timeout`.

**Diagnostic (mesure des 7 presets réels)** : la ligne F-GNAM pèse **9,07 Mo**
dans une seule cellule JSONB. Décomposition :
- `weighingReport.pdfData` : **4,6 Mo** — un PDF (Fiche de pesée) en base64
  inline (`data:application/pdf;base64,…`). Donnée réelle.
- `workshop.image.url` : **2,7 Mo** — les images d'abaque rasterisées (MANEX)
  en base64, une par modèle (la variante Flaps TAKEOFF : 1 Mo à elle seule).
  Aide de construction, ré-importable.
- `fitted` : **1,5 Mo** — 33 600 points dérivés (200/courbe × 168). DÉRIVÉ.

Postgres TOAST/réécrit toute la valeur (+ index) à chaque UPDATE ; combiné au
cycle lire-fusionner-réécrire de `updateCommunityPreset`, ça dépasse les ~8 s.

**Livré (partie SÛRE, non destructive)** :
- `core/fittedRuntime.ts` : `stripFittedGraphs` / `stripFittedFromAircraftData`
  (retire `fitted.points`, garde method+rmse) + `ensureFittedGraphs`
  (régénère à la lecture). **Équivalence prouvée bit-à-bit** sur les 168
  courbes réelles (écart max 0,000000) ET en round-trip cascade : strip→régen
  donne le MÊME résultat de perf (1922.4994 = 1922.4994, etc.).
- Écriture allégée : `handleExportJSON` (source) + `communityService`
  submit/update (APRÈS la fusion, sinon `deepMergeKeepExisting` ré-introduit
  le gros fitted de la ligne actuelle).
- Lecture : `ensureFittedGraphs` au point d'entrée des 2 fonctions cascade
  (couvre prép. vol via atelierCascadeAdapter, test in-builder, banc) + au
  chargement AbacBuilder (affichage Chart/canevas).
- Gain fitted : −1,5 Mo. **Ne suffit PAS seul** (reste 7,5 Mo à cause des 2
  blobs base64 → le PDF de pesée domine).

**Reste (décision pilote — données réelles)** : le keystone est le **PDF de
pesée (4,6 Mo)** + les **images d'abaque (2,7 Mo)**, stockés inline. Ils
doivent aller dans Supabase Storage (motif MANEX déjà en place : bucket
`manex-files` + `manex_file_id`), PAS dans le JSONB. Externalisation à scoper
(upload au save, référence, lazy-load, RLS, migration des 7 lignes).

**Déblocage immédiat non destructif** : remonter le statement_timeout du rôle
(SQL à lancer par le pilote dans l'éditeur Supabase) — voir réponse.

### R20/B — Externalisation des blobs vers Storage (2026-06-15)

Le strip `fitted` (−1,5 Mo) ne suffisait pas : le PDF de pesée (4,6 Mo) et les
images d'abaque (2,7 Mo) base64 dominaient. B les sort du JSONB vers Storage
(motif MANEX), aircraft_data ne garde qu'une URL courte.

- `scripts/setup-blob-buckets.sql` (PILOTE lance, comme manex-files) : buckets
  publics `weighing-reports` (PDF) + `abaque-images` (PNG/JPEG/WebP) + policies
  authenticated. Inclut (commenté) le ALTER ROLE statement_timeout de R20/A.
- `src/services/blobStorage.js` : `externalizeAircraftBlobs(aircraftData,
  {registration})` — uploade les data-URL base64, remplace par l'URL publique
  (`weighingReport.pdfUrl` ; `workshop.image.url` = URL https). NON DESTRUCTIF
  (base64 conservé si l'upload échoue), idempotent (URL https non re-uploadée).
- `communityService` submit + update : externalise APRÈS strip fitted / fusion
  → la ligne réécrite est légère, même pour les avions historiques (le base64
  fusionné depuis l'ancienne fiche est externalisé au passage). C'est ce qui
  fait réellement passer sous le timeout (write ~500 Ko au lieu de 9 Mo).
- Lecture : viewers pesée (Step3 + Step6) préfèrent `pdfUrl` puis base64 puis
  IndexedDB ; le canevas `<image href={workshop.image.url}>` accepte l'URL
  https tel quel (aucun changement). Copie locale IndexedDB inchangée (garde
  le base64 → lazy-load owner toujours OK).
- Migration : pas de script séparé — ré-ouvrir+sauver chaque avion
  l'externalise (l'externalisation se fait AVANT l'écriture → 1ʳᵉ sauvegarde
  déjà légère). R20/A (timeout) couvre le SELECT de la grosse ligne d'ici là.

Vérifié (navigateur, storage mocké) : succès → pdfData retiré/pdfUrl posé,
image.url en https, layout conservé, taille 1486→500 ; échec → base64 conservé
(non destructif) ; idempotent → URLs inchangées au rejeu. Build vert.

**ACTION PILOTE** : (1) lancer `scripts/setup-blob-buckets.sql` dans l'éditeur
SQL Supabase ; (2) ouvrir l'avion qui échouait et le sauver → il s'allège.

## 29. R21 — Crash OOM « Mes avions » : la liste « légère » ne l'était plus (2026-06-17)

**Déclencheur** : « Render process gone, out of memory » ~quelques secondes
après l'ouverture de « Mes avions », sans autre erreur console. Le pilote
soupçonnait la taille des photos.

**Diagnostic (mesuré)** : les photos NE sont PAS la cause (redimensionnées à
≤1200 px à l'import, ≤4 Mo décodés, ~24 Mo total — sous le seuil OOM). La vraie
cause : le mapping `lightAircraft` (contexts/index.jsx) qui construit la liste
en mémoire ne strippait que les ANCIENS gros champs (`photo`, `manex`,
`sourceImage`). Il ignorait les blobs accumulés depuis (R20) :
`fitted` (200 pts/courbe), `workshop.image.url` base64 (~2,7 Mo),
`weighingReport.pdfData` base64 (~4,6 Mo). **Mesure : la liste pesait 31,2 Mo
en state** (F-GIEA 13 Mo, F-GNAM 9 Mo) pour TOUS les avions à la fois →
saturation du renderer. Aggravé par l'effet photo qui charge en plus le record
IDB COMPLET (getAircraftData) par avion.

**Fix** :
- `contexts/index.jsx` (mapping light) : strip aussi `fitted.points`,
  `workshop.image` (base64) et `weighingReport.pdfData`. **Mesuré : 31,2 Mo →
  4,1 Mo (−87 %)**. Vérifié : structure préservée (registration, systemType /
  operationId des modèles, courbes, méta pesée hasData/fileName/cert) ; seuls
  les octets lourds partent. Sûr : l'édition recharge le record COMPLET depuis
  IndexedDB (handleEdit → getAircraftData), le moteur cascade régénère `fitted`
  (ensureFittedGraphs, R20), la visionneuse pesée recharge via URL/IDB.
- `Step1BasicInfo` (demande pilote) : alerte explicite sur le TYPE d'image
  (refus JPEG/PNG/WebP only — HEIC/TIFF/BMP/GIF rejetés avec message) + alerte
  taille chiffrée. Avant : retour silencieux sur type non-image.

Build vert. Même racine que R20 (blobs base64 dans aircraft_data) : la liste
mémoire et l'écriture DB souffraient du même mal ; R21 traite le volet mémoire.

## 30. R22 — Couverture des tables de performance dans la fiche avion (2026-06-17)

Remplace le contrôle binaire « Tables de performance : présent/absent » par une
liste NOMINATIVE des tables manquantes, contre un minimum de 8 (décollage +
atterrissage, roulage + franchissement, × volets). Décisions pilote : att.
LANDING + lisse ; groupe à poids FIXE (6) ; chaque table ignorable via bypass ;
remplace le booléen.

- `operationCatalog.ts` : `getExpectedPerformanceOperations()` (les 8 ids, ordre
  d'affichage). Source de vérité unique.
- `performanceCoverage.js` (nouveau) : `computeMissingPerformanceTables(aircraft,
  bypassedSet)` — présent = systemType + operationId du primaire de chaque
  modèle ; manquant = attendu − présent − ignoré. + `getFlapsUnspecifiedModels`
  (legacy sans volets, synergie R17).
- `aircraftCompleteness.js` : champ booléen retiré ; groupe « Performances »
  poids fixe 6 (gagné si 0 manquante), tables manquantes poussées dans `missing`
  (poids 0, group:'PERFORMANCE') + exposées via `missingPerformanceTables`.
- `AircraftModule.jsx` : bloc dédié « Performances — tables manquantes » dans le
  panneau À compléter (exclu des groupes par criticité), chaque table avec un
  bouton « non applicable » → `handleTogglePerfBypass` (charge le record COMPLET,
  patche bypassedFields, persiste via updateAircraft).

Vérifié (navigateur, presets réels) : 8 attendues ; avion vide → 8 manquantes ;
F-GNAM (takeoff TO+UP + landing LANDING) → manque exactement les 2 landing-lisse
(« Flaps UP ») ; bypass des 2 → couvert, % 85→91. Build vert.

## 31. R23 — Classification UNIFIÉE abaques ↔ extraction par tableau (2026-06-17)

**Déclencheur** : le pilote remarque que la classification 3-listes (Phase /
Métrique / Volets → operationId), présente côté ABAQUES (R17), MANQUE côté
extraction de performances par TABLEAU (2ᵉ méthode), qui n'avait qu'une liste
PLATE de ~16 opérations. Demande : exporter cette capacité de tri/classification
vers l'extraction par tableau pour unifier la classification.

**Livré** :
- `OperationClassifier.tsx` (nouveau) : le classifieur 3-listes EXTRAIT de
  GraphIdentityPanel (R17) en composant partagé. Émet l'operationId via
  onChange ; props `direction` (row/column) + `compact` pour s'adapter au
  panneau abaque comme à l'overlay de vignette MANEX.
- `GraphIdentityPanel.tsx` : refactor — utilise le composant partagé (helpers
  inline + imports morts retirés). Comportement identique (outputKind/outputUnit
  préservés).
- `PerformanceWizard.jsx` : la liste plate sur la vignette de page est remplacée
  par `<OperationClassifier compact direction="column">`. Même taxonomie, même
  tri Phase→Métrique→Volets ; la valeur stockée (pageClassifications) reste un
  operationId du catalogue (compat inchangée).

**Vérifié (navigateur)** : le classifieur partagé résout correctement
(Atterrissage → Roulage → Flaps UP = `landing_ground_roll_flaps_up`, contrôlé) ;
GraphIdentityPanel rend toujours le classifieur (phase=takeoff pour un preset),
aucune régression. Build vert.

Synergie R22 : à terme, performanceCoverage devrait aussi compter les tableaux
(advancedPerformance.tables) ainsi classés — note de suite.

## 32. R24 — Re-classification des tableaux DÉJÀ convertis (uniformisation) (2026-06-17)

**Déclencheur** : sur un avion existant dont les tableaux MANEX ont déjà été
convertis, la classification est FIGÉE — impossible de la modifier. Le pilote
veut reprendre tous les avions et uniformiser.

**Constat** : un tableau converti stocke `operationId` + `classification` (=
operationId, ex. « takeoff_ground_roll »). Le récap (Step4Performance) groupe
par classification mais (a) affichait le libellé via une liste codée en dur
OBSOLÈTE (takeoff-normal, landing-normal…) qui ne matchait plus les vrais ids
→ id brut affiché ; (b) n'offrait aucune édition de la classification (juste
Modifier les données / Supprimer).

**Livré** (Step4Performance) :
- Libellé via `getOperation(classification).labelFr` (catalogue canonique) au
  lieu de la liste codée en dur.
- Sur chaque groupe : `OperationClassifier` (R23, partagé) pré-rempli avec la
  classification courante → le pilote re-choisit Phase/Métrique/Volets.
- `reclassifyTableGroup(old, newOpId)` : ré-étiquette TOUS les tableaux du
  groupe (operationId + classification), updateData + setSavedPerformanceData
  (mêmes persistance que Supprimer ; écrit à la sauvegarde de la fiche). Suit
  la sélection d'export (ancienne clé → nouvelle).

**Synergie** : les tableaux hérités sans volets (takeoff_ground_roll,
takeoff_50ft) s'affichent « volets non précisés — hérité » + le classifieur
montre « précise les volets » (rouge) → le pilote est guidé pour uniformiser.

**Vérifié (navigateur)** : label legacy = « Distance sol décollage (volets non
précisés — hérité) » ; classifieur sur valeur héritée → phase=takeoff +
avertissement « précise les volets » ; choix Flaps UP → émet
`takeoff_ground_roll_flaps_up` ; le transform ré-étiquette le bon groupe et
laisse les autres intacts. Build vert.
