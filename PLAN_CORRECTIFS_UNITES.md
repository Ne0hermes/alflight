# PLAN DE CORRECTIFS — Unités & équations Masse / Centrage

> Dérivé de l'audit [AUDIT_MASSE_CENTRAGE_UNITES.md](AUDIT_MASSE_CENTRAGE_UNITES.md) v2.0 (2026-06-10).
> Ordre = **ordre d'exécution recommandé** (les dépendances priment sur la sévérité).
> ⚠️ Règle d'or : **ne rien corriger avant la Phase 0** (le filet de tests doit être rouge AVANT, vert APRÈS).
> Taille : S < ½ j · M ≈ 1 j · L ≥ 2-3 j.

## Journal d'exécution

**2026-06-10 — branche `feat/owned-clone-manex` (suite 13 fichiers / 135 tests verts + 4 tripwires, build prod OK) :**
- ✅ **C0.1** `weightBalanceStore.invariance.test.js` — preuve rouge actée (run du 10/06 15:03 : USA lbs/in, Metric cm, enveloppe Europe, marge ×4) puis figée en `it.fails` (tripwires : ils CASSERONT quand C2/C3/C5 corrigeront le flux ⇒ obligation de les rebasculer en `it()`).
- ✅ **C0.2** `unitConversions.matrix.test.js` — 12 paires armLength contre références, aller-retours, fail-closed, alias, densité. 7 rouges avant Phase 1, tout vert après.
- ⬜ **C0.3** restant : bascule ×20, assistant démonté, StrictMode (à écrire avec C2.3).
- ✅ **C1.1** clé manquante ⇒ throw (dev/test) / NaN + console.error (prod) — plus jamais la valeur d'origine.
- ✅ **C1.2** non-numérique ⇒ NaN (plus de `return 0`) ; bonus : `0` redevient une valeur valide (0 °C → 32 °F, le garde `!value` l'avalait).
- ✅ **C1.3** `toStorage`/`fromStorage` : catch ⇒ `null`/`''` + garde `Number.isFinite` (fini le nombre brut).
- ✅ **C1.4** densité paramétrable : `galToLbs`/`lbsToGal(density)`, `toStorage/fromStorage(opts)` transmis à `convertValue`.
- ✅ **C1.5** `console.log` du chemin chaud supprimés.
- ✅ **C1.6** alias `km/h`→`kmh`, `m/s`→`ms`, `mi/h`→`mph` normalisés avant construction de clé (les conversions de vitesse du préréglage metric passaient en pass-through silencieux).
- ✅ **C3.6** (anticipé, S) Step6 : densité via `getFuelDensity` canonique aux 3 sites — entrée de calcul fail-closed (plus de masse fabriquée si type inconnu), affichages avec repli AVGAS signalé en attendant la Phase 3.

**2026-06-10 (suite) — PHASE 2 + C3.1 livrées (suite 138 tests verts + 4 tripwires, build prod OK) :**
- ✅ **C3.1** Pivot bras = **MÈTRE** acté et appliqué : `mbUnits.STORAGE_UNITS.armLength 'mm'→'m'`, `unitsDisplay.CANONICAL_UNITS` idem, `convertMoment` dérivé du pivot (kg·m), en-têtes corrigés. Triple justification vérifiée : moteur+goldens en m, `centrogramAdapter` normalise déjà en m (`convertArmUnit(…,'m')`), normaliseur d'import en m. Aucun consommateur externe des helpers canoniques de bras (grep) → pas de régression.
- ✅ **C2.1/C2.2** TOUS les champs masses et bras de Step3 passent par `fromStorage` (affichage) / `toStorage` (saisie) : masse à vide/MTOW/MLW/masse min, trio à vide (masse/bras/moment), sièges av/arr/additionnels, compartiments (trio), réservoirs (bras/moment, capacité déjà canonique), corde MAC/LEMAC (désormais canonique m + libellé dynamique), points Forward (trio), Aft 2 points (2 trios), placeholders unit-aware, indicateur de cohérence converti.
- ✅ **C2.3** Effet de réécriture in-place **SUPPRIMÉ** (ex-l.294-466) — un changement de préférence ne touche plus jamais la donnée. Élimine M2/M3/M4/M6 + ANO-17 d'un coup.
- ✅ **C2.4/C2.5** Les champs stockent des **nombres canoniques** (kg, m, kg·m) ; tous les recalculs inline (2-sur-3 à vide, trios compartiments/réservoirs/enveloppe) opèrent en canonique.
- ✅ **Hydratation wizard** : `normalizeAircraftForWizard` (armUnits.js) — bras `armToMeters` (>10⇒÷1000) + moments `momentToKgM` (>50 000⇒÷1000) sur arms/moments/cgLimits/cgEnvelope/sièges/compartiments/réservoirs à l'ouverture d'un avion legacy. Masses jamais devinées (ANO-11).
- ✅ **Affichages alignés** : graphe double Step3 + Step5Review (récap M&C complet + enveloppe) convertissent canonique→user ; %MAC du PDF (AircraftModule) rendu homogène via `armToMeters` sur les 3 longueurs.
- ✅ **Filet vert C2** : 3 nouveaux tests d'invariance « via toStorage » (Europe mm / USA lbs·in / Metric cm ⇒ même CG 2,132 m, même verdict, enveloppe comprise) — le contrat est figé.
- ⚠️ Restes assumés : tripwires legacy toujours rouges (données stockées non migrées → **C5**) ; métadonnée `aircraftStore` constante `'mm'` volontairement non touchée (la basculer déclencherait la migration legacy piégée — traité par **C3.2** dédié) ; `cgLimits`/enveloppe côté moteur pour le stock legacy non réédité → **C3.3 moteur + C5**. Vérification navigateur du wizard à faire (session requise) — la preuve actuelle est data-layer + build.

**2026-06-10 (suite) — C3.2 + C5 dry-run livrés (suite 138 verts + 4 tripwires, build prod OK) :**
- ✅ **C3.2** Métadonnée VRAIE + piège désamorcé : ① création (`addAircraft`) écrit `_metadata { version:'3.0.0', unitsVerified:true, units.armLength:'m' }` ; ② `updateAircraft` estampille aussi v3 (la réédition wizard vaut re-confirmation — hydratation + frontières garantissent le canonique) ; ③ **chemin de lecture** : `unitsVerified===true` ⇒ aucune migration par métadonnée (sinon `'m' ≠ 'mm'` aurait déclenché `convertAircraftUnits` ×1000 — le piège ANO-9) ; pour le legacy, la comparaison reste sur l'ancienne constante (comportement inchangé, commentaire d'avertissement posé : la métadonnée historique MENT sur armLength, désambiguïsation = C5).
- ✅ **C5.4 (dry-run)** `scripts/units-migration-dry-run.js` — LECTURE SEULE, exécuté sur la base réelle (6 avions) : **4 MIGRABLE_AUTO** (bras tous en m), **2 QUARANTAINE** (F-HFGI : `arms.frontSeats=403.7` + `tanks[1].arm=337` + 4 valeurs d'enveloppe ambiguës mm/cm ; F-GOVE : `arms.frontSeats=394` ambigu mm/cm), **masses 6/6 AMBIGU_KG_OU_LBS** (preuve empirique : la magnitude ne tranche jamais kg/lbs), **unitsVerified 0/6** (stock pré-v3). Rapport : `scripts/units-dry-run-report.json`.
- ⬜ Reste C5 : script d'APPLICATION (après revue humaine du rapport + re-confirmation pilote pour les 2 avions en quarantaine et pour les masses), bascule des tripwires en `it()` après migration, puis C3.4 (heuristique → détecteur).

**2026-06-10 (suite) — C5 APPLIQUÉE EN BASE (décisions pilote actées) :**
- ✅ **Décisions pilote** (AskUserQuestion) : ① valeurs ambiguës F-HFGI/F-GOVE = **mm** ; ② masses des 6 avions = **kg** ; ③ application autorisée avec sauvegarde.
- ✅ **C5.2/C5.3/C5.4** `scripts/units-migration-apply.js` exécuté : sauvegarde intégrale (`backup-community-presets-2026-06-10T16-00-35-915Z.json`) → **6/6 écritures OK, ~70 conversions journalisées** (`units-migration-journal-…json`) : bras mm→m (F-HFGI ×6, F-GOVE ×6 dont fuelMain 1102.7→1.1027), moment kg·mm→kg·m (F-GOVE baggage momentMax 50604→50.604, cohérent 40 kg × 1.2651 m), typage string→number partout, métadonnée v3 + `migration:'C5-2026-06-10'` estampillée sur les 6.
- ✅ **Vérification finale (dry-run re-exécuté)** : bras 6/6 ARMS_OK_M, enveloppe 6/6 OK_M, quarantaine 0, unitsVerified 6/6. Plancher de plausibilité abaissé 0,20→0,15 m (cas réel F-HFGI forward cg = 0,19 m, datum bord d'attaque).
- ✅ **Correctif ciblé post-migration validé pilote** : F-GOVE `weightBalance.fuelArm` « 10 » aberrant → interprété 0,254 m (in) par la règle → **corrigé à 1,1027 m** sur décision pilote explicite (3 champs concordants du même avion), via `scripts/fix-fgove-fuelarm.js` (garde anti-double-exécution + trace `_metadata.fixFgoveFuelArm`).
- ⬜ Restes : bascule des tripwires (après C3.3 moteur — l'enveloppe des avions NON réédités est désormais en m en base, mais les copies IndexedDB locales des utilisateurs restent legacy → l'heuristique moteur reste nécessaire, **C3.4 toujours en dernier**) ; recette navigateur du wizard.

---

## Phase 0 — Filet de sécurité (AVANT toute correction)

| # | Correctif | ANO | Fichiers | Taille |
|---|-----------|-----|----------|--------|
| **C0.1** | **Test d'invariance par unité** : même avion physique saisi sous Europe (kg/mm), USA (lbs/in), Metric (kg/cm) ⇒ même CG, même verdict (ε déclaré). Doit ÉCHOUER aujourd'hui sur USA et Metric = preuve du bug, puis verrou permanent | ANO-11, 12 | `src/core/stores/__tests__/` (étendre les golden) | M |
| **C0.2** | **Test matrice de conversion exhaustive** : toutes paires × valeurs de référence + propriété aller-retour `b→a∘a→b ≈ id` + cas « clé manquante » (rouge tant que CV-1 existe) + conversions carburant avec densité AVGAS/JET-A1/MOGAS | ANO-3, 14 | nouveau `src/utils/__tests__/unitConversions.test.js` | M |
| **C0.3** | Tests adversariaux : bascule de préférence ×20 (dérive), préférence changée assistant démonté, moment périmé + 2-sur-3, StrictMode double-effet | ANO-8, 15, 16 | tests Step3 | M |

## Phase 1 — Fail-closed du convertisseur (stopper les corruptions silencieuses)

| # | Correctif | ANO | Fichiers:lignes | Taille |
|---|-----------|-----|----------|--------|
| **C1.1** | `convertValue` : clé de conversion introuvable ⇒ **throw** (dev/test) / valeur marquée invalide (prod). Supprimer le `return numValue` silencieux | ANO-3 (P0) | `unitConversions.js:249-250` | S |
| **C1.2** | `convertValue` : supprimer `return 0` sur falsy/NaN ⇒ retourner `NaN`/lever, jamais un zéro plausible | ANO-7 | `unitConversions.js:166-169` | S |
| **C1.3** | `toStorage`/`fromStorage` : le `catch` ne retourne plus le nombre brut ⇒ `null` + erreur surfacée (le verdict aval suit le modèle `cgReliable`) | ANO-4 (P0) | `mbUnits.js:63-66, 86-89` | S |
| **C1.4** | **Densité obligatoire** pour toute conversion volume↔masse : `toStorage` transmet `options.density` ; `galToLbs`/`lbsToGal` paramétrés (supprimer le 6.01 figé) ; refuser la conversion si densité absente | ANO-14 | `mbUnits.js:62`, `unitConversions.js:21,31` | M |
| **C1.5** | Retirer les `console.log` du chemin chaud de conversion | ANO-10 | `unitConversions.js:186, 240` | S |
| C1.6 | Remplacer le dispatch par concaténation de chaîne par une table de correspondance explicite (élimine la classe d'erreurs `'km/h'`/casse) | CV-4 | `unitConversions.js:184-233` | M |

## Phase 2 — Frontières de saisie (le cœur des bugs m/mm ET kg/lbs)

| # | Correctif | ANO | Fichiers:lignes | Taille |
|---|-----------|-----|----------|--------|
| **C2.1** | **Champs MASSE de Step3 → conversion bidirectionnelle** : `fromStorage()` sur `value=`, `toStorage()` à l'`onChange` pour masse à vide (l.1570), MTOW (l.1679), MLW (l.1696), minTakeoffWeight, maxBaggageFwd/Aft, `maxWeight` des compartiments. **Répliquer le patron du champ capacité carburant (l.1044-1074)** | ANO-2, 11 (P0) | `Step3WeightBalance.jsx` | M |
| **C2.2** | **Champs BRAS de Step3 → idem** : réservoirs (l.1079-1097), sièges (l.1282-1287), compartiments (l.1451-1466), cgLimits, points d'enveloppe (poids ET cg) | ANO-2 (P0) | `Step3WeightBalance.jsx` | M |
| **C2.3** | **SUPPRIMER l'effet de réécriture in-place** (l.294-466) : un changement de préférence ne touche plus jamais la donnée stockée (pivot), seulement l'affichage. Élimine d'un coup les mécanismes M2 (bascule kg→lbs persistée), M3 (fenêtre assistant démonté), M4 (dérive d'arrondis), M6 (moments périmés) et ANO-17 (sync aftCG) | ANO-8, 15, 16, 17 | `Step3WeightBalance.jsx:294-466` | M |
| C2.4 | Stocker des **nombres**, pas des strings : `parseFloat` à la frontière de saisie (aujourd'hui `e.target.value` brut) | M5 | `Step3WeightBalance.jsx` | S |
| C2.5 | Recalcul 2-sur-3 masse/bras/moment : opérer en unités **canoniques** (le moment stocké devient kg·m, conversion à l'affichage seulement) | ANO-16 | `Step3WeightBalance.jsx:255-289` | S |

## Phase 3 — Pivot unique & moteur

| # | Correctif | ANO | Fichiers:lignes | Taille |
|---|-----------|-----|----------|--------|
| **C3.1** | **Acter le pivot unique : longueur = m, masse = kg, moment = kg·m, volume = L** — dans UN module constant. Aligner `mbUnits.STORAGE_UNITS.armLength: 'mm'→'m'` (+ commentaire moment kg·mm→kg·m), `unitsDisplay.CANONICAL_UNITS`, et tout consommateur | ANO-1 (P0) | `mbUnits.js:25-34`, `unitsDisplay.js:30-44` | M |
| **C3.2** | **Métadonnée VRAIE** : à la sauvegarde, écrire `schemaVersion` + les unités **réellement utilisées** (plus jamais la constante figée). Pré-requis de la migration (Phase 5) | ANO-9 (P0) | `aircraftStore.js:309-319` | S |
| **C3.3** | **Enveloppe CG dans le pivot** : normaliser/valider les limites CG et points d'enveloppe en mètres à l'entrée moteur (aujourd'hui exclus de la normalisation) ⇒ comparaison `cg vs forward/aft` garantie homogène | ANO-13 (P0/P1) | `armUnits.js:48`, `weightBalanceStore.js:97-103, 233-236` | M |
| **C3.4** | ⚠️ **APRÈS la Phase 5 uniquement** : transformer l'heuristique `armToMeters` (>10⇒÷1000) de correcteur silencieux en **détecteur d'alerte** (log + `cgReliable=false` + quarantaine). La retirer avant la migration casserait les avions mixtes existants | ANO-12 (P0) | `armUnits.js:39-43`, `aircraftNormalizer.js:96-104` | S |
| C3.5 | Fusionner les deux moteurs de CG (`calculateWeightBalance` vs `calculateFromItems` des scénarios) en un seul point de calcul | ANO-6 | `weightBalanceStore.js` ↔ `calculations.js:65-70` | M |
| C3.6 | Step6 : densité via `getFuelDensity(aircraft.fuelType)` (source unique) au lieu du string-match `includes('JET')` | ANO-14 | `Step6WeightBalance.jsx:309-327` | S |
| C3.7 | Comparaisons d'enveloppe avec tolérance ε ; ne plus tronquer le CG calculé (`toFixed(3)`) — l'arrondi devient affichage uniquement | CTRL-3.5/3.6 | `weightBalanceStore.js:235, 244` | S |
| C3.8 | Bornes de plausibilité physique à la saisie et à l'entrée moteur : bras ∈ ]0;10] m (GA), masse à vide < MTOW, masses > 0… ⇒ erreur explicite, jamais un calcul « plausible » | CTRL-2.6 | moteur + Step3 | M |

## Phase 4 — IHM & affichages

| # | Correctif | ANO | Fichiers:lignes | Taille |
|---|-----------|-----|----------|--------|
| **C4.1** | Libellés d'unité figés → dynamiques (`getMBUnitSymbol`) : axes et tooltip du graphe (`Centre de Gravité (mm)` l.397, `Moment (kg.m)` l.410, tooltip l.343-344), en-têtes de table (l.133-135, formule l.197), Step6 (l.828+), moments PDF `kg·mm` (l.853, 882). Supprimer les `×1000` du graphe une fois le pivot unifié (l.58-59, 402) | ANO-5 | `WeightBalanceChart.jsx`, `WeightBalanceTable.jsx`, `Step6WeightBalance.jsx`, `AircraftModule.jsx` | M |
| C4.2 | **%MAC : trancher** — implémenter la formule `(CG−LEMAC)/MAC×100` avec homogénéité stricte (3 longueurs même pivot) OU retirer les champs morts `macLength`/`lemac` | §2.2 | `cgEnvelope.js`, `centrogramAdapter.js:112-113` | S/M selon décision |
| C4.3 | Factoriser les 3 écrans de préférences d'unités dupliqués | CTRL-1.7 | `features/units`, `features/pilot` ×2 | S |

## Phase 5 — Migration des données existantes (sans corruption)

| # | Correctif | ANO | Détail | Taille |
|---|-----------|-----|--------|--------|
| **C5.1** | Toute **nouvelle** écriture porte `schemaVersion` + unités réelles (livré par C3.2) ⇒ borne la population à migrer | ANO-9 | `aircraftStore.js` | — |
| **C5.2** | **Migration BRAS** (m/mm/cm/in) : pour chaque avion legacy, tester les interprétations candidates, recalculer le CG, confronter à l'enveloppe propre + plage physique ]0;10] m. Une seule interprétation plausible ⇒ migrer + journal. Sinon ⇒ quarantaine | ANO-1, 12 | script de migration + dry-run | L |
| **C5.3** | **Migration MASSES kg/lbs** : la magnitude est inopérante ⇒ comparer masse à vide + MTOW aux **préréglages communautaires du même modèle** (ratio ≈ 2,20 simultané sur les deux champs = signature lbs). Ambiguïté ⇒ quarantaine : `units='UNVERIFIED'`, **verdict de centrage désactivé** (fail-closed), bannière de re-confirmation pilote. **Jamais de coercition silencieuse** | ANO-11 | script + `communityAircraftDatabase` comme référentiel | L |
| **C5.4** | Procédure : backup → **dry-run lecture seule** → rapport (migrés / quarantaine, avant/après, marges) → revue humaine → application → journal réversible | — | scripts + PV | M |

---

## Récapitulatif des dépendances critiques

```
C0.* (filet rouge)
  └─► Phase 1 (convertisseur fail-closed)
        └─► Phase 2 (frontières de saisie — corrige le flux NEUF)
              └─► Phase 3 : C3.1 pivot + C3.2 métadonnée vraie + C3.3 enveloppe
                    └─► Phase 5 (migration du STOCK existant)
                          └─► C3.4 (l'heuristique devient détecteur — EN DERNIER)
Phase 4 (IHM) : parallélisable dès la Phase 2.
```

**Définition de fini (DoD) :** C0.1 vert sur ≥ 3 avions réels sous les 3 préréglages ; C0.2 100 % des paires ; zéro pass-through restant (grep `returning original value`, `return num`, `return 0` dans les convertisseurs) ; rapport de migration validé ; revue croisée signée.
