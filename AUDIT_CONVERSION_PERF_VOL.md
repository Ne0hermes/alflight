# AUDIT — Conversion d'unités (distance) — abaques en PRÉPARATION DE VOL

**Date** : 2026-06-22
**Périmètre** : chaîne d'évaluation abaque du module Performance —
`atelierCascadeAdapter.js` → `operationResolver.js` → `PerformanceStateMatrix.jsx`,
moteur `abac/curves/core/cascade.ts`.
**Déclencheur (pilote)** : F-GNAM (PA-28), opération `takeoff_ground_roll_flaps_up`,
conditions OAT 27 °C / PA 505 ft / masse 1013 kg / vent 0 kt.
Distance de décollage **attendue ≈ 1000 ft** ; l'app **affiche « 1008.98 m »**.

> À lire avec [`AUDIT_MOTEUR_PERF_VOL.md`](AUDIT_MOTEUR_PERF_VOL.md). Cet audit-là
> traite l'**ordre d'évaluation** (valeurs aberrantes, −7363 m) et sa bascule
> moteur (P0). Le présent audit traite l'**unité / la conversion**, un problème
> **orthogonal qui SURVIT à la bascule moteur**.

---

## Données réelles confirmées (Supabase live, 2026-06-22)

Lecture du preset F-GNAM (`id 513e9ccc-…`), comparaison des DEUX modèles décollage :

| | Flaps UP (sol) `takeoff_ground_roll_flaps_up` | Flaps TAKEOFF (15 m) `takeoff_50ft_flaps_to` |
|---|---|---|
| `workshop.sharedY` | **unit=ft** [400..2400] | unit=m [300..1000] |
| `yAxis.unit` (3 graphes) | **ft** | m |
| `yAxis.title` | **« altitude »** ❌ | « takeoff_distance_50ft » ✅ |
| `outputUnit` (primaire) | **« m »** ❌ (contredit ft) | « m » ✅ (cohérent) |
| Plage Y réelle | 875…1272 (**pieds** plausibles, roulage PA-28) | 305…579 (mètres plausibles) |
| Réparé ? | **NON** | OUI (`scripts/fix-fgnam-flapsto-y-m-mass-mirror.js`, R18) |

➡️ **Le modèle Flaps UP est en PIEDS** mais son `outputUnit` primaire vaut « m » —
incohérence INTERNE. L'**ancien** moteur lit `primary.outputUnit` ⇒ affiche « m »
(le bug observé). Le **nouveau** moteur lit `lastGraph.axes.yAxis.unit = 'ft'` ⇒
afficherait « ft » : la bascule corrige l'étiquette **pour ce modèle par effet de
bord**, mais l'incohérence de données subsiste (et casserait un modèle portant
l'erreur inverse). Le modèle Flaps TAKEOFF prouve que la réparation se fait
**au cas par cas** — le Flaps UP a été oublié.

➡️ **Encodage de famille hétérogène CONFIRMÉ (C4)** : primaire = « 0ft,1000ft,…,
5000ft » ; panneau masse = « 0,1,2,3,4,5 » (milliers de ft). PA=505 ft bracketé
contre [0..5] → t=499 → **64296** (le 64296.93 de la trace). Casse l'ancien
moteur ; le nouveau interroge le panneau masse sur X=masse, donc immunisé là-dessus.

---

## Constats

### C0 — Aucune conversion d'unité dans toute la chaîne abaque (RACINE)
La valeur produite est le **nombre brut lu sur l'axe Y** ; l'unité n'est qu'une
**étiquette**, jamais un facteur appliqué.
- `atelierCascadeAdapter.js:187-188` → `finalValue = res.finalValue` (brut),
  `outputUnit = lastGraph.axes.yAxis.unit`. Aucune conversion.
- `operationResolver.js:393-394` → `value: finalValue`,
  `unit: cascade.outputUnit || graph.outputUnit || opDef.acceptedOutputs[0].defaultUnit || ''`.
- `cascade.ts` ne contient **aucun** `×0.3048` ; il compare seulement des
  *chaînes* d'unité pour choisir un axe (lignes 1334-1336).
- `PerformanceStateMatrix.jsx:212` affiche `value` + `unit` tels quels.

➡️ Si l'abaque est **tracé en pieds** (valeurs ~1000) mais que l'unité Y stockée
vaut `m` (ou est vide → repli catalogue `OUT_DISTANCE.defaultUnit = 'm'`,
`operationCatalog.ts:86`), on lit **un nombre en pieds étiqueté mètres**. C'est
exactement le cas : 1008.98 (≈ 1000 ft attendus) affiché « m ».

### C1 — L'étiquette d'unité = métadonnée d'abaque non fiable (cause directe du « m » faux)
L'unité vient de `lastGraph.axes.yAxis.unit`. Pour F-GNAM Flaps UP, l'axe Y est
**titré « altitude »** (cf. trace pilote : « Y = altitude »), donc unité/titre Y
**mal capturés à la création** dans l'atelier. Unité vide ⇒ repli silencieux sur
`'m'`. **La bascule moteur (P0) corrige les valeurs aberrantes, PAS l'unité** :
tant que la métadonnée Y de l'abaque n'est pas `ft` / `Distance`, l'affichage
reste faux.

### C2 — Titre Y « altitude » → misrouting latent (MAJEUR)
`titleToConditionDim('altitude')` → `'pressure_altitude'`
(`atelierCascadeAdapter.js:41`). Un axe de **sortie** titré « altitude » est en
réalité une **distance** ; s'il était un jour relu comme entrée d'un panneau
chaîné, il serait routé sur l'altitude. Ici ça « marche » par chance (le Y du
dernier graphe n'est pas re-mappé) mais c'est un piège. Côté pilote, afficher
« Y = altitude » pour une distance de décollage est trompeur.

### C3 — Dans le build du pilote, le 1008.98 vient du moteur DÉPRÉCIÉ (contexte)
La trace fournie — **primaire en DERNIER**, panneau masse *bracketé* sur
`pressure_altitude = 6 / 7` → t = 499 → **64296.93** — est celle de
`evaluateAbacCascade` (`abacInterpolation.js`), **pas** du moteur atelier. Donc le
build exécuté est **antérieur** à la bascule (changements non commités de la
session parallèle). **Le 1008.98 est le résultat d'un calcul cassé qui tombe par
hasard près de 1000 — il n'est pas fiable.** Après build/déploiement de la
bascule : valeurs plausibles (garde « distance > 0 »), mais l'unité (C0/C1) reste
fausse.

### C4 — Encodage hétérogène de l'altitude-famille (lié, unités)
Dans la trace, l'altitude-famille est encodée **« 6000ft » / « 7000ft »**
(primaire) MAIS **« 6 » / « 7 »** (panneau masse). PA = 505 ft comparé à 6/7 →
extrapolation t = 499. Symptôme conjoint du moteur déprécié **et** d'un encodage
de famille « en milliers de ft » non normalisé. Le moteur atelier lit la famille
du primaire correctement, mais l'encodage hétérogène des guides reste un risque
data à fiabiliser à la création.

---

## Impact sécurité
- **Erreur d'unité d'un facteur ~3.28** : une distance en pieds lue comme mètres
  (ou l'inverse) fausse gravement la distance de décollage / atterrissage
  exploitable. Critique pour le choix de piste et de déroutement.
- Avant bascule, la valeur vient en plus d'un moteur cassé (« plausible mais
  faux »).

---

## Remédiation recommandée

- **K0 — Fiabiliser l'unité à la SOURCE (atelier).** Capture obligatoire et
  validée de `axes.yAxis.unit` (`ft` | `m`) et `title` (`Distance`, jamais
  `altitude`) à la création de l'abaque. **Corriger la fiche F-GNAM** : Y =
  Distance, unité = ft.
- **K1 — Conversion canonique explicite.** Introduire une conversion distance
  unique (réutiliser le motif de `src/utils/elevationUtils.js` —
  `M_TO_FT = 3.28084`, jeux de tokens `ft`/`m`) appliquée au moment de produire
  `result.value` / `result.unit` : choisir une **unité canonique d'affichage**
  (décision pilote : ft ou m) et convertir depuis l'unité native de l'abaque.
  Ne **jamais** afficher la valeur brute avec une étiquette potentiellement fausse.
- **K2 — Garde d'unité (cohérente avec P1).** Pour une opération `distance`, si
  `axes.yAxis.unit` est **absente / inconnue**, NE PAS retomber silencieusement
  sur `'m'` → `status: ERROR` ou warning « unité de l'abaque non déclarée ». Le
  repli catalogue `'m'` fabrique une fausse unité.
- **K3 — Interdire « altitude » comme titre d'axe de SORTIE distance.**
  Validation à la création + warning runtime si `outputKind === 'distance'` et
  `yAxis.title`/`unit` ressemblent à une altitude.
- **K4 — Normaliser l'encodage des familles d'altitude** (ft vs milliers de ft)
  à la création (lié C4).

> ⚠️ Coordination : la chaîne `operationResolver.js` / `abacInterpolation.js` est
> en cours de réécriture (session parallèle, bascule moteur atelier non commitée).
> K1/K2 touchent `operationResolver.js` → à intégrer **avec** cette bascule, pas
> en parallèle, pour éviter un conflit. K0/K3/K4 relèvent de l'atelier de création
> et de la donnée F-GNAM.

---

## Annexe — chaîne de preuve (file:line)
- `atelierCascadeAdapter.js:187` `finalValue = res.finalValue` ; `:188`
  `outputUnit = lastGraph.axes.yAxis.unit` — aucune conversion.
- `operationResolver.js:393` `value: finalValue` ; `:394` repli unité → `'m'`.
- `operationCatalog.ts:82-88` `OUT_DISTANCE.defaultUnit = 'm'` (repli).
- `cascade.ts:1334-1336` comparaison d'unités par chaîne, sans facteur.
- `PerformanceStateMatrix.jsx:212` affichage `value` + `unit` bruts.
- `atelierCascadeAdapter.js:41` `titleToConditionDim('alt') → 'pressure_altitude'`.
- Trace pilote : `Y = altitude` ; T2 masse bracket `pressure_altitude 6/7`,
  t = 499 → 64296.93 (moteur déprécié `abacInterpolation.js`).
