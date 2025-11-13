# Correction masse à vide F-HSTR (1200 → 900 kg)

## 🎯 Problème
La masse à vide de F-HSTR est **1200 kg dans Supabase** au lieu de **900 kg**.

## ✅ Solution 1 : Script console ROBUSTE (RECOMMANDÉ)

### Étape 1 : Ouvrir la console
1. Ouvrez votre application : **http://localhost:4001**
2. Appuyez sur **F12** pour ouvrir les outils développeur
3. Allez dans l'onglet **Console**

### Étape 2 : Charger le script V2

**Option A - Copier depuis le fichier :**
```javascript
// Chargez le contenu de scripts/fix-fhstr-mass-v2.js
```

**Option B - Coller directement :**
Voir le contenu complet dans `scripts/fix-fhstr-mass-v2.js`

### Étape 3 : Vérifier le résultat

Le script V2 affiche des informations détaillées :

**Si SUCCÈS :**
```
✅✅✅ SUCCÈS CONFIRMÉ ! ✅✅✅

La masse à vide de F-HSTR est maintenant 900 kg dans Supabase
Bras à vide: 2.45 m
Moment à vide: 2205.0 kg.m

🔄 Rechargez la page (F5) pour voir les changements partout !
```

**Si ÉCHEC :**
```
❌❌❌ ÉCHEC DE LA SAUVEGARDE ❌❌❌

La masse dans Supabase est toujours: 1200 kg

SOLUTION : Utilisez la méthode manuelle
```

### Étape 4 : Recharger la page

**Appuyez sur F5** pour recharger la page.

## 📊 Vérification

Après rechargement, vous devriez voir :

| Paramètre | Valeur correcte |
|-----------|-----------------|
| Masse à vide | **900 kg** (au lieu de 1200) |
| Bras à vide | 2.45 m |
| Moment à vide | 900 × 2.45 = **2205 kg.m** |
| MZFW | 1100 kg |

## 🔄 Alternative : Via l'interface

Si le script ne fonctionne pas :

1. Allez dans le **module "Avions"** (page d'accueil)
2. Sélectionnez **F-HSTR**
3. Cliquez sur l'icône **"Modifier"** (crayon)
4. Dans la section **Masse et centrage**
5. Changez **Masse à vide** de **1200** à **900**
6. **Sauvegardez** (en bas du wizard)
7. La modification sera sauvegardée dans Supabase automatiquement

## ❓ Besoin d'aide ?

Si aucune des solutions ne fonctionne, contactez-moi avec :
- Les messages de la console
- Une capture d'écran
