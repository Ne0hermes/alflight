# Guide de débogage pour les aérodromes de déroutement

## Pour tester le calcul du carburant de déroutement :

### 1. Prérequis
- Ouvrir la console du navigateur (F12)
- Vérifier que l'application est lancée

### 2. Étapes de test

1. **Onglet "Gestion Avions"**
   - Sélectionner un avion
   - Vérifier que la consommation et la vitesse sont définies
   - Si non, les modifier et sauvegarder

2. **Onglet "Navigation"**
   - Créer une route avec au moins 2 points (départ et arrivée)
   - Attendre que le calcul de route se termine

3. **Onglet "Déroutement"**
   - Attendre que les suggestions apparaissent
   - Sélectionner au moins un aérodrome côté départ OU côté arrivée
   - Observer la console pour les logs commençant par 🛢️

4. **Onglet "Fuel"**
   - Vérifier la ligne "Alternate"
   - Si elle affiche "Calcul en cours...", vérifier la console

### 3. Logs importants dans la console

Chercher ces messages :
- `🛢️ Pas de calcul:` - Indique pourquoi le calcul ne se fait pas
- `🛢️ Alternates à analyser:` - Montre les aérodromes sélectionnés
- `🛢️ Position manquante pour` - Un aérodrome n'a pas de coordonnées
- `🛢️ Distances calculées:` - Montre les distances calculées
- `🛢️ Aucune distance valide` - Aucune distance n'a pu être calculée

### 4. Problèmes courants

#### "Calcul en cours..." persiste
- **Cause** : Pas d'aérodrome sélectionné ou position manquante
- **Solution** : 
  1. Vérifier dans la console les logs 🛢️
  2. Re-sélectionner les aérodromes
  3. Rafraîchir la page si nécessaire

#### Carburant reste à 0
- **Cause** : Distance = 0 ou avion sans consommation
- **Solution** :
  1. Vérifier que l'avion a une consommation définie
  2. Vérifier que les aérodromes ont des positions valides
  3. Observer les logs de distance dans la console

#### Pas de détails affichés
- **Cause** : maxDistanceAlternate.distance = 0
- **Solution** :
  1. Re-sélectionner les aérodromes
  2. Vérifier que le selectionType est bien défini (departure/arrival)

### 5. Structure attendue d'un aérodrome sélectionné

```javascript
{
  icao: "LFPG",
  name: "Paris Charles de Gaulle",
  position: { lat: 49.0097, lon: 2.5479 },
  selectionType: "departure" // ou "arrival"
  // ... autres propriétés
}
```

### 6. Vérification manuelle dans la console

Taper ces commandes dans la console :

```javascript
// Voir les alternates sélectionnés
useAlternatesStore.getState().selectedAlternates

// Voir l'avion sélectionné
localStorage.getItem('selectedAircraft')

// Voir les waypoints
JSON.parse(localStorage.getItem('waypoints') || '[]')
```

## Notes importantes

- Le calcul utilise la distance maximale entre tous les aérodromes
- Les aérodromes côté départ sont mesurés depuis le départ
- Les aérodromes côté arrivée sont mesurés depuis l'arrivée
- Une réserve de 30 minutes est automatiquement ajoutée