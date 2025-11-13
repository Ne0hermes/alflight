# Correction de la masse à vide de F-HSTR

## Problème
La masse à vide de F-HSTR affiche 1200 kg au lieu de 900 kg dans Supabase.

## Solution

### Option 1: Console navigateur (RECOMMANDÉ)

1. Ouvrez votre application dans le navigateur
2. Ouvrez la console développeur (F12)
3. Collez et exécutez ce code:

```javascript
import('@core/stores/aircraftStore').then(module => {
  module.fixFHSTREmptyWeight();
});
```

### Option 2: Via l'interface utilisateur

1. Allez dans le module "Avions"
2. Sélectionnez F-HSTR
3. Modifiez manuellement la masse à vide à 900 kg
4. Sauvegardez les modifications
5. Les changements seront automatiquement sauvegardés dans Supabase

## Vérification

Après la correction, vérifiez que:
- Masse à vide = 900 kg
- MZFW = 1100 kg
- Bras à vide = 2.45 m
- Moment à vide = 900 × 2.45 = 2205 kg.m

## Modifications apportées

### Fichiers modifiés:
1. **aircraftStore.js** (ligne 209-255)
   - Implémentation de `updateAircraft` avec sauvegarde Supabase
   - Ajout de `fixFHSTREmptyWeight()` helper function

2. **communityService.js** (ligne 507-595)
   - Méthode `updateCommunityPreset` déjà existante
   - Permet de mettre à jour les presets dans Supabase

## Fonctionnement de la sauvegarde

Désormais, **TOUTES les modifications d'avions** seront sauvegardées automatiquement dans Supabase grâce à:

1. **Optimistic update** : La mise à jour locale est immédiate
2. **Background sync** : La sauvegarde Supabase se fait en arrière-plan
3. **Gestion d'erreurs** : Si Supabase échoue, l'utilisateur n'est pas bloqué

```javascript
// aircraftStore.js - updateAircraft()
// 1. Mise à jour locale immédiate
const newList = [...state.aircraftList];
newList[index] = validatedAircraft;
set({ aircraftList: newList, isLoading: false });

// 2. Sauvegarde Supabase en arrière-plan
await communityService.updateCommunityPreset(
  validatedAircraft.id,
  validatedAircraft
);
```

## Logs

Les modifications sont loggées dans Google Sheets :
🔗 https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
