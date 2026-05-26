# SESSION STATE — ALFlight (17 mai 2026)

Document de reprise de session. Si tu lis ce fichier, c'est probablement parce qu'on est dans un nouveau chat après saturation du contexte. Lis-le en entier avant de toucher au code.

---

## 1. Contexte du projet

**ALFlight** = app React (Vite 7) de gestion de vol pour pilotes.
- Stack : React 18, Zustand, Supabase (BDD + RLS + Auth), gpt-4o vision, D3 pour les graphiques, MUI partiel.
- Localhost : `npm run dev` → port **4000** (Vite). Log dev : `D:\Applicator\alflight\tracking\vite-stdout.log`.
- Logging Google Sheets via `scripts/claude-log-action.ps1`. Sheet : <https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k>. Le serveur log est souvent injoignable → ne pas s'inquiéter.

---

## 2. Sprints livrés

| Sprint | Sujet | Statut |
|---|---|---|
| **1** | Bugs bloquants flight wizard (carburant manquant Step7Summary, MANEX inaccessibles, ordre args `convertValue` carburant, validations wizard avion) | ✅ |
| **2** | Architecture : unification stores avion, RLS Supabase, auth userId, alias `@lib`→relative path, simplification entrée avion via MANEX + IA | ✅ partiel — RLS strict SQL fourni mais non appliqué par l'utilisateur |
| **3** | Pipeline extraction MANEX (gpt-4o vision) → écran validation → injection `updateDataBulk` dans le wizard | ✅ |
| **4 phase 1** | MVP éditeur Bézier autonome `src/abac/v2/` (calque PDF + clic + Bézier + poignées). **Démo retirée, plus utilisée.** | ✅ (mais hors flow actuel) |
| **4 phase 2** | Filigrane PDF intégré dans `AbacBuilder` (Chart.tsx + UI), sous-étapes par graphique, calibration multi-points par axe | ✅ |
| **4 phase 3 — Sprint A (calibration multi-points)** | Clic sur graduations de l'image → ticks calibrés → scale piecewise linéaire | ✅ livré aujourd'hui |
| **4 phase 3 — Sprint B (refonte intégrale du flow abaque)** | Mini-wizard par graphique : Image → Ajustement → Axes (min/max/pas) → Grille → Points. Navigation libre. Interpolation finale. | 🟡 **EN COURS — pas commencé** |

---

## 3. Bugs résolus notables

| Bug | Cause | Fix |
|---|---|---|
| « Carburant insuffisant » fantôme en fin de wizard | `setFobFuel(nombre)` au lieu de `{ltr, gal}` → `fobFuel.ltr = undefined` | `setFobFuel` rendu défensif + onRehydrateStorage normalise + Step6/Step7 passent objet |
| MANEX inaccessibles | 5 erreurs syntaxe ManexViewer + flag `hasData` au lieu de `hasIndexedDBData` + viewer non importé | Syntaxe fix + flag corrigé + import + câblage AircraftModule |
| Conversion carburant cassée | Ordre args `convertValue(value, fromUnit, toUnit, category)` inversé 5 fois | Audit régressif corrigé Step1BasicInfo + Step5Fuel |
| RMSE 66 sur courbe interpolée | Outlier `(20.15, 878.58)` inséré par clic fantôme | Diagnostiqué, pas un bug d'interpolation — l'isolation par courbe/graph est OK dans le code |
| Drag d'un point recrée un point | Click event synthétisé après drag | `wasDraggingRef` consomme le click suivant |
| Graphique s'étire après ajout courbe | `width/height` interne basé sur containerSize (ResizeObserver) | Fixé à `propWidth/propHeight`, viewBox stable, étirement visuel par CSS uniquement |
| Image filigrane suit le resize du graphique | Image en coords data | Refonte image en pixels SVG inner |
| OpenAI `content null` | `data.choices[0].message.content` peut être null (refusal/content_filter) | Optional chaining + erreur explicite avec finish_reason interprété |
| OpenAI refuse « I'm sorry » | System message + prompt mentionnaient « aviation/manuel » | System neutre « chart digitizer » + prompt en termes math génériques + champ « Indices IA » utilisateur |

---

## 4. Architecture clé partie abaque

```
src/abac/
├── curves/
│   ├── core/
│   │   ├── types.ts         ← XYPoint, Curve, GraphConfig, AxesConfig, AbacJSON
│   │   ├── manager.ts       ← AbacCurveManager (fit, addPoint, etc.)
│   │   ├── interpolation.ts ← PCHIP, Akima, Natural Spline, Catmull-Rom
│   │   ├── api.ts, cascade.ts, axesUtils.ts
│   └── ui/
│       ├── AbacBuilder.tsx  ← 🔴 composant principal, ~2700 lignes. SWITCH currentStep 'axes'/'points'/'final'
│       ├── Chart.tsx        ← SVG D3 (xScale, yScale piecewise si customXTicks/Y, background image en pixels, drag points, calibration mode)
│       ├── AxesForm.tsx     ← formulaire MUI (min, max, titre, unit) — pas de champ "step" pour le moment
│       ├── CurveManager.tsx ← liste courbes
│       ├── PointsTable.tsx  ← tableau points éditable
│       └── GraphManager.tsx
└── v2/                       ← ⚠️ MVP éditeur Bézier autonome (Sprint 4 phase 1), plus utilisé dans le flow
```

**Chart.tsx props clés** :
- `axesConfig`, `curves`, `selectedCurveId`
- `backgroundImage: { url, x, y, width, height }` en pixels SVG inner
- `imageAdjustMode`, `onBackgroundImageChange`
- `customXTicks?: { value, pixel }[]`, `customYTicks?: { value, pixel }[]` — piecewise scale
- `calibrationMode?: 'x' | 'y' | null`, `onCalibrationClick?` — mode interactif

**AbacBuilder.tsx state clés** :
- `graphs`, `selectedGraphId`, `selectedCurveId`
- `backgroundImages: Record<graphId, { url, x, y, width, height }>` — pixels
- `chartSizes: Record<graphId, { width, height }>` — taille étirable
- `imageAdjustGraphId: string | null` — un seul à la fois
- `customAxisTicks: Record<graphId, { x?, y? }>` — calibration multi-points
- `calibrationState: { graphId, axis, valuesToCalibrate, currentIndex, collected } | null`
- `subStepGraphIndex: number` — sous-étape par graphique
- `aiHints, aiNotes, aiDetectingGraphId` — détection IA

---

## 5. Décisions de design importantes

1. **Image filigrane en pixels SVG inner** (pas en data coords) : reste fixe quand on resize le graphique, ne suit que les poignées de drag/resize de l'image.
2. **Resize libre par bord** (8 poignées) : 4 coins + 4 milieux pour étirer X ou Y indépendamment.
3. **viewBox SVG fixe** : pas de re-render des scales sur ResizeObserver — sinon l'image bouge en ajoutant une courbe.
4. **Calibration multi-points** : `scaleLinear().domain(values).range(pixels)` pour interpolation linéaire par morceaux entre les graduations cliquées. Corrige les déformations non-uniformes du scan.
5. **System message OpenAI neutre** pour analyses d'image — évite les refus heuristiques.
6. **Filtrage `subStepGraphIndex`** : un seul graph visible à la fois dans la sous-étape, mais tous les états restent en mémoire.
7. **Anti-rebond click/drag** : `wasDraggingRef` consomme le click synthétisé après mouseup.

---

## 6. Refonte demandée par l'utilisateur (Sprint B)

### Le flow voulu

Mini-wizard **par graphique** avec navigation libre Précédent/Suivant :

1. **Importer image** (PDF/PNG)
2. **Repositionner image** (drag + resize libre — déjà fait dans Chart)
3. **Définir axes** : Min, Max, **Pas** pour X et Y. La PREMIÈRE graduation = Min (peut être 150, pas forcément 0). Génère automatiquement les ticks.
4. **Grille pointillée** affichée automatiquement entre les ticks
5. **Calibration sur l'image OBLIGATOIRE** : tout part de l'image, le graphique se construit dessus
6. **Placer points courbe par courbe** (à refondre — l'utilisateur veut une nouvelle UX, pas spécifié encore en détail)
7. → Graphique suivant
8. **À la fin de tous les graphiques** : bouton "Interpoler tous les graphiques" + validation

### Position utilisateur confirmée

- Tout part de l'image (image = source de vérité, pas les valeurs abstraites)
- Refondre la saisie courbes/points (étape 5) — UX nouvelle à définir
- Navigation libre entre sous-étapes
- Combinaison drag manuel + calibration multi-points selon le besoin

### Effort estimé : 3-5h

---

## 7. Audit UX (synthèse — 17 mai 2026)

🔴 Critique :
- 12 `alert()` primitifs bloquants → migrer vers MUI Snackbar
- Suppressions sans confirmation ni undo
- 2 modes (calibration + ajustement image) peuvent coexister → ambigu
- Mélange MUI / styles inline custom (incohérence visuelle)
- `onCalibrationClick` reporte pixel inner mais c'est mal documenté

🟡 Moyen :
- 3 composants importés non utilisés (`PointEditor`, `ChainCalculator`, `CascadeCalculator`)
- 20+ console.log de prod
- Mix FR/EN dans labels et enums
- Double navigation (subStepGraphIndex + expandedGraphs)

🟢 Léger :
- Bouton "Configurer un axe" alors qu'il crée un graphique
- Pas de feedback visuel pour le mode calibration en cours
- 8 poignées image non documentées

### 5 suggestions structurantes pour Sprint B

1. **State machine unique pour les modes** : `editorMode: 'idle' | 'calibrating-x' | 'calibrating-y' | 'adjusting-image' | 'drawing'` — impossible d'avoir 2 modes actifs.
2. **Design system unifié** : tout en MUI, retirer styles inline, palette de couleurs unique.
3. **Confirmation + undo** : modale pour suppressions critiques, Snackbar avec UNDO 3s pour toutes les actions destructives.
4. **Calibration documentée dans l'UI** : badge "Calibration Y : graduation 3/5", curseur spécialisé, bordure visuelle du Chart.
5. **Nettoyage code mort** : virer `PointEditor`, `ChainCalculator`, `CascadeCalculator` du bundle abaque.

---

## 8. Tâches en attente / dette technique

- **Cleanup files** (en attente d'autorisation user) :
  - `alflight/src/features/aircraft/AircraftModule.jsx.backup`
  - `alflight/src/features/aircraft/components/wizard-steps/Step3WeightBalance_backup.jsx`
  - `alflight/src/features/aircraft/components/wizard-steps/Step6Operations.jsx` (code mort)
  - `alflight/Calfightflight-management-systemserver.env` (vide, accident copier-coller chemin)
  - 3 autres fichiers à nom corrompu
- **RLS Supabase strict** : SQL fourni dans `alflight/supabase-rls-strict.sql`, non appliqué par l'utilisateur. Tant que c'est pas fait, n'importe qui peut écraser les presets community.
- **Auth `userId` null hardcodé** dans `aircraftStore.js:474` — à connecter à la vraie session Supabase.
- **Step1BasicInfo.jsx:346/359** : useEffect de conversion d'unité auto avec ordre args faux. Inoffensif (la conversion ne se déclenche pas) mais à fixer proprement.
- **Sprint 4 phase 3 — Sprint B** : la refonte intégrale est à faire (cf. §6).

---

## 9. Conventions importantes

- **Logging Drive après chaque tâche** : `& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "..." -Details "..." -Files "..." -Component "..."` (mais le serveur est souvent down, accepter l'échec).
- **Parser JSX/TSX avant commit** : `node -e "..."` avec `@babel/parser` depuis `D:/Applicator/alflight/node_modules`.
- **Pas de `git commit` sans demande explicite** de l'utilisateur.
- **Pas de suppression de fichiers** sans validation explicite (le classifier auto-refuse).
- **Vite peut crasher** silencieusement (ça nous est arrivé). Vérifier `Get-NetTCPConnection -LocalPort 4000` régulièrement.
- **Le user veut une réponse en français**, factuelle, sans bla-bla diplomatique.

---

## 10. Prochaine action recommandée

Si tu reprends sur Sprint B :

1. Créer `src/abac/curves/ui/AbacGraphWizard.tsx` : composant orchestrant les 5 sous-étapes pour un graphique
2. Étendre `GraphConfig.axes.xAxis.step?: number` dans `types.ts`
3. Modifier `Chart.tsx` : utiliser `step` pour générer les ticks si pas de `customXTicks`
4. Modifier `AxesForm.tsx` : ajouter input "Pas"
5. Refonte `AbacBuilder.tsx` : nouvelle étape `graphs` qui rend `AbacGraphWizard` pour le graph courant de `subStepGraphIndex`
6. Étape finale `final` : bouton "Interpoler tous" + validation
7. Migration douce : si un graph existe sans `step`, fallback ticks D3 auto

État machine recommandée :
```ts
type EditorMode = 'idle' | 'adjusting-image' | 'calibrating-x' | 'calibrating-y' | 'placing-points';
```

Au revoir, futur Claude. Bonne refonte.
