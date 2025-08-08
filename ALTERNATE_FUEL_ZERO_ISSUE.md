# 🔍 Problème : Carburant Alternate reste à 0

## Symptômes observés
- Les gallons et litres pour le carburant alternate restent à 0
- Les logs montrent : `🛢️ Distance LFGA depuis départ: 0 NM`
- Les logs montrent : `🛢️ Distance LFST depuis arrivée: 0 NM`

## Cause probable
Les aérodromes sélectionnés comme alternates (LFGA et LFST) sont exactement aux mêmes coordonnées que les points de départ et d'arrivée, ce qui donne une distance de 0 NM.

## Scénarios possibles

### Scénario 1 : Sélection automatique des mêmes aérodromes
L'utilisateur a sélectionné comme alternates les mêmes aérodromes que le départ et l'arrivée :
- LFGA est l'aérodrome de départ ET est sélectionné comme alternate départ
- LFST est l'aérodrome d'arrivée ET est sélectionné comme alternate arrivée

**Solution** : Ne pas permettre de sélectionner comme alternate le même aérodrome que le départ/arrivée

### Scénario 2 : Problème de coordonnées
Les coordonnées des alternates ne sont pas correctement récupérées ou stockées.

**Solution** : Vérifier dans les logs les coordonnées exactes

## Logs de débogage ajoutés

1. **Points de référence** : Affiche les waypoints de départ et arrivée
2. **Calcul de distance détaillé** : Affiche les coordonnées from/to
3. **Détection de points identiques** : Alerte si les points sont trop proches

## Actions à faire par l'utilisateur

### 1. Vérifier les logs dans la console
Chercher :
```
🛢️ Points de référence:
🛢️ Calcul distance LFGA depuis départ
⚠️ Points identiques ou très proches
```

### 2. Vérifier les aérodromes sélectionnés
Dans la console :
```javascript
// Voir les alternates
const alts = useAlternatesStore.getState().selectedAlternates;
console.table(alts.map(a => ({
  icao: a.icao,
  name: a.name,
  lat: a.position?.lat,
  lon: a.position?.lon,
  type: a.selectionType
})));

// Voir les waypoints
const wpts = JSON.parse(localStorage.getItem('waypoints') || '[]');
console.table(wpts.map(w => ({
  name: w.name,
  lat: w.lat,
  lon: w.lon || w.lng
})));
```

### 3. Sélectionner des alternates différents
**Important** : Les aérodromes de déroutement doivent être DIFFÉRENTS des aérodromes de départ et d'arrivée.

Exemple :
- Départ : LFPG (Paris CDG)
- Arrivée : LFBO (Toulouse)
- Alternate départ : LFPO (Paris Orly) - ✅ Différent de LFPG
- Alternate arrivée : LFBD (Bordeaux) - ✅ Différent de LFBO

## Solution proposée

### Option 1 : Empêcher la sélection du même aérodrome
Ajouter une vérification pour empêcher de sélectionner comme alternate :
- Le même aérodrome que le départ (pour alternate départ)
- Le même aérodrome que l'arrivée (pour alternate arrivée)

### Option 2 : Distance minimale
Imposer une distance minimale (ex: 10 NM) entre l'aérodrome et son alternate.

### Option 3 : Avertissement utilisateur
Afficher un message d'avertissement si l'alternate sélectionné est trop proche (< 5 NM).

## Test rapide

1. Sélectionner des alternates DIFFÉRENTS du départ/arrivée
2. Observer les logs - les distances devraient être > 0
3. Le carburant alternate devrait se calculer correctement

## Exemple de bon fonctionnement

```
Départ : LFPG (Paris CDG) - 49.0097°N, 2.5479°E
Alternate départ : LFPO (Paris Orly) - 48.7233°N, 2.3794°E
Distance : ~20 NM

Arrivée : LFBO (Toulouse) - 43.6294°N, 1.3639°E  
Alternate arrivée : LFBD (Bordeaux) - 44.8283°N, -0.7156°E
Distance : ~120 NM

Carburant alternate calculé sur la distance max (120 NM)