# AUDIT — Moteur d'évaluation des abaques en PRÉPARATION DE VOL

**Date** : 2026-06-12
**Périmètre** : `src/services/abacInterpolation.js` (`evaluateAbacCascade` + interpolateurs internes), consommé par `src/services/operationResolver.js` → matrice de couverture (`PerformanceStateMatrix`) du module Performance.
**Déclencheur** : écart pilote de +10 % sur la distance de décollage PA-28-181 (F-GNAM, abaque « Flaps TAKEOFF », 2000 ft / 21 °C / 1089 kg / 8 kt de face : 626 m au lieu de ~567 m attendus). Le 626 venait du moteur de l'ATELIER (`cascade.ts`, bug de ligne de référence **corrigé — R20**) ; l'audit ci-dessous porte sur le SECOND moteur, celui que la préparation de vol utilise réellement.

---

## Méthode

Reproduction sur données réelles (copie Supabase de F-GNAM), via le vrai point d'entrée de la préparation de vol :

```js
resolveOperation(aircraft, 'takeoff_50ft_flaps_to', {
  mass: 1089.01, massTakeoff: 1089.01, oat: 21,
  pressureAltitude: 2000.01, headwind: 8, windComponent: 8, tailwind: -8
})
```

**Résultat : `status: COMPUTED`, `value: −7363 m`** (distance NÉGATIVE, présentée comme calculée).
Même appel vent nul : −7605 m. Trace :

| Étape (ordre moteur) | Mode | Query | Entrée Y | Sortie |
|---|---|---|---|---|
| Graphique 2 (panneau MASSE) | bracket | 1089.01 | — | **155 749,33** |
| Graphique 3 (panneau VENT) | slope-follow | 8 | 155 749 | 151 386 |
| Graphique 1 (OAT×altitude, PRIMAIRE) | slope-follow | 21 | 151 386 | **−7 363** |

À titre de comparaison, le moteur de l'atelier (`cascade.ts`, après correctif R20) sur les mêmes données et entrées : **546,5 m** (étages 707,9 → 625,2 → 546,5), conforme à l'abaque papier à la tolérance de lecture près.

---

## Constats

### A1 — Ordre d'évaluation inversé pour les abaques multi-panneaux (CRITIQUE)
`evaluateAbacCascade` ordonne : intermédiaires (par `cascadeOrder`) **puis le primaire en DERNIER** (lignes ~789-796). Sur un abaque POH multi-panneaux (PA-28, Cessna…), le PRIMAIRE (OAT×altitude) est l'**entrée** qui produit la distance de base, et les panneaux de correction (masse, vent) viennent APRÈS — c'est la chaîne gauche→droite de l'atelier (G1→G2→G3, `linkedTo`). Le moteur du vol applique la convention inverse (« les intermédiaires fabriquent les entrées du primaire »), valable pour un autre type d'enchaînement mais fausse ici. Conséquence : le panneau masse est évalué EN PREMIER, sans entrée.

### A2 — Premier intermédiaire évalué en « bracket » sur la MAUVAISE dimension (CRITIQUE)
En première position (i = 0), le mode retombe sur `family`/bracket. `bracketInterpolateGraph` a résolu la famille du panneau masse sur… **l'altitude pression (2000)**, comparée aux valeurs de famille des guides (0…11) — d'où le warning observé « Extrapolation HAUT : pressure_altitude = 2000.0 au-delà de la courbe la plus haute (11) » et la sortie aberrante 155 749. La résolution de dimension est devinée à partir des titres, sans contrat avec la structure réelle du panneau.

### A3 — Mutation des conditions pilote en cours de cascade (MAJEUR)
`conditions[xDim] = previousOutput` (lignes ~851-852, ~866-867) : les sorties intermédiaires ÉCRASENT les conditions saisies par le pilote (ici `conditions.mass` ← 155 749) pour les étapes suivantes. Toute étape ultérieure qui relit cette dimension consomme une valeur corrompue.

### A4 — Aucune garde de plausibilité sur la sortie (MAJEUR)
Une distance **négative** (−7 363 m) ressort en `status: COMPUTED` et part vers la matrice d'affichage comme un résultat valide. Aucun contrôle « distance > 0 », « ordre de grandeur vs plage Y des graphes », ni invalidation quand un step a extrapolé de plusieurs ordres de grandeur.

### A5 — Moteur DUPLIQUÉ = source de vérité violée (STRUCTUREL)
Deux implémentations de la même lecture d'abaque coexistent :
- `src/abac/curves/core/cascade.ts` — moteur de l'ATELIER (banc R13, validation), corrigé R20, couvert par tests ;
- `src/services/abacInterpolation.js` — réimplémentation parallèle (slope-follow, bracket, filtre vent, IDW de secours) utilisée par le VOL.
Elles divergent sur l'ordre, l'entrée des panneaux, les modes et les fallbacks. Tout correctif appliqué à l'une (R11, R12, R20…) laisse l'autre fausse. C'est la violation déjà relevée par l'audit données/calculs (Single Source of Truth).

### A6 — Pour mémoire : chemin TABLEAUX (audité le même jour, hors abaques)
`tableInterpolationAdapter` ignore totalement le **vent** (trilinéaire masse×alt×temp, aucun warning), fusionne des tables d'**unités différentes** sans conversion (cas H-HDIM : page 90 « ft » + page 91 étiquetée « m » mais en pieds), et ne distingue pas les **configurations volets**. Voir log du 2026-06-12.

---

## Impact sécurité

- La matrice de performance du vol peut afficher des valeurs absurdes (négatives) — au mieux visiblement fausses, au pire « plausibles mais fausses » sur d'autres modèles (l'IDW de secours, A5, est exactement le genre de mécanisme qui fabrique du plausible).
- Le pilote qui valide son set dans l'atelier (banc R13 OK) n'a AUCUNE garantie que la préparation de vol calcule pareil : les deux moteurs ne partagent ni code ni tests.

## Remédiation recommandée

- **P0 — Unifier sur le moteur de l'atelier** : dans `operationResolver`, le chemin abaque délègue à `performCascadeCalculationWithParameters` (cascade.ts) : chaîne via `findGraphChain` (primaire d'abord, liens `linkedTo`), `GraphParameters` construits depuis les conditions (altitude → primaire ; chaque panneau mappé par `axes.xAxis.title` : mass, wind_component + windDirection déduite du signe). Supprimer `evaluateAbacCascade` et ses interpolateurs internes après bascule (`inputsToConditions` et l'inspection restent).
- **P1 — Gardes de plausibilité** : sortie d'une opération `distance` ⇒ finie, > 0, et dans [yMin, yMax] étendus du primaire ; sinon `status: ERROR` explicite (jamais COMPUTED).
- **P2 — Test d'équivalence des moteurs** : tant que les deux coexistent, un test rejoue le set de référence (F-GNAM) sur les deux et échoue si |Δ| > 1 %. Disparaît avec P0 achevé.
- **P3 — Chemin tableaux** (A6) : règle de vent paramétrable par table (note POH), refus de fusion d'unités/volets hétérogènes, warning « vent non pris en compte » en attendant.

---

## Annexe — preuves

- Services (vol), Flaps TO, 8 kt face : steps `[bracket mass→155749, slope-follow wind→151386, slope-follow oat→−7363]`, warnings « pressure_altitude = 2000.0 au-delà de la courbe la plus haute (11) ».
- Atelier (cascade.ts R20), mêmes entrées : `707,9 → 625,2 → 546,5 m` ; vent calme : étage vent strictement neutre (625,2 → 625,2).
- Avant R20 (bug ligne de référence) : `707,9 → 706,5 → 626,1 m` — le 626 observé par le pilote.
