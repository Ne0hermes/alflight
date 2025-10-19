# 🔧 RÉPARATION RAPIDE - IndexedDB Corrompu

## 🚨 Problème actuel
IndexedDB est corrompu et empêche l'application de fonctionner correctement.

## ✅ Solution rapide (2 méthodes)

### Méthode 1 : Via la console du navigateur (RECOMMANDÉ)

1. **Ouvrez la console du navigateur** :
   - Chrome/Edge : `F12` → Onglet "Console"
   - Firefox : `F12` → Onglet "Console"

2. **Copiez-collez cette commande** dans la console :

```javascript
indexedDB.deleteDatabase('FlightManagementDB').onsuccess = () => {
  console.log('✅ Base supprimée');
  setTimeout(() => location.reload(), 1000);
};
```

3. **Appuyez sur Entrée**

4. **L'application va se recharger** avec une base de données propre

### Méthode 2 : Via les DevTools

1. **Ouvrez les DevTools** (`F12`)

2. **Allez dans l'onglet "Application"** (Chrome/Edge) ou "Stockage" (Firefox)

3. **Dans le menu de gauche** :
   - Développez "IndexedDB"
   - Trouvez "FlightManagementDB"
   - **Clic droit** → **"Supprimer la base de données"**

4. **Rechargez la page** (`F5`)

## 🎯 Après la réparation

1. **L'application devrait se charger normalement**
2. **Ré-importez vos avions** depuis votre fichier JSON d'export
3. **Les photos et MANEX devront être ré-ajoutés** manuellement

## 🔄 Pour ouvrir sur le bon port

**Fermez tous les onglets** et ouvrez : **http://localhost:4001**

(Pas le port 4003 qui était dans votre cache)

## 💡 Pourquoi ce problème ?

IndexedDB peut se corrompre lors de :
- Mises à jour de schéma de base de données
- Interruptions brutales du navigateur
- Changements de version pendant le développement

## 📞 Si le problème persiste

1. **Videz le cache complet du navigateur** :
   - `Ctrl + Shift + Delete`
   - Cochez "Données de sites et cookies"
   - Videz le cache

2. **Redémarrez le navigateur**

3. **Rouvrez http://localhost:4001**
