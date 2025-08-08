# 📚 Guide des APIs pour télécharger les cartes VAC

## 🎯 Vue d'ensemble

Il n'existe pas d'API publique officielle pour télécharger les cartes VAC françaises. Ce guide présente les différentes options disponibles et comment les implémenter.

## 📊 Comparaison des solutions

| Source | Type | Coût | Fiabilité | Limitations |
|--------|------|------|-----------|-------------|
| **SIA France** | Site officiel | Gratuit | ⭐⭐⭐⭐⭐ | Pas d'API, URLs changent tous les 28 jours |
| **OpenFlightMaps** | API | Gratuit (limité) | ⭐⭐⭐ | Pas toutes les cartes, limite de requêtes |
| **Proxy local** | Serveur | Gratuit | ⭐⭐⭐⭐ | Nécessite un serveur backend |
| **Jeppesen** | API Pro | €€€€ | ⭐⭐⭐⭐⭐ | Très cher, professionnel uniquement |
| **ForeFlight** | API | €€ | ⭐⭐⭐⭐ | Abonnement requis |
| **Scraping** | Automatisation | Gratuit | ⭐⭐ | Fragile, peut casser |

## 🚀 Solution 1 : Serveur Proxy Local (Recommandé)

### Installation

1. **Installer les dépendances** :
```bash
cd server
npm install express cors axios puppeteer
```

2. **Démarrer le serveur** :
```bash
# Windows
start-vac-proxy.bat

# Linux/Mac
node server/vac-proxy-server.js
```

### Utilisation dans l'application

```javascript
import { vacDownloadService } from '@services/vacDownloadService';

// Télécharger une carte VAC
const result = await vacDownloadService.downloadVAC('LFPG', {
  useProxy: true
});

if (result.success) {
  console.log('Carte téléchargée:', result);
}
```

### Endpoints disponibles

- `POST /api/vac-download` - Télécharger une carte
- `GET /api/airac-info` - Infos cycle AIRAC
- `POST /api/clear-cache` - Vider le cache
- `GET /health` - État du serveur

## 🌐 Solution 2 : OpenFlightMaps API

### Configuration

1. **Obtenir une clé API gratuite** :
   - Aller sur https://www.openflightmaps.org/api-info
   - Créer un compte
   - Obtenir votre clé API

2. **Configurer la clé dans l'application** :
```javascript
vacDownloadService.setApiKey('openflightmaps', 'VOTRE_CLE_API');
```

### Limitations
- 100 requêtes/jour en gratuit
- Pas toutes les cartes disponibles
- Principalement Europe

## 📅 Solution 3 : URLs directes SIA (Manuel)

### Structure des URLs SIA

Les URLs changent à chaque cycle AIRAC (tous les 28 jours) :

```
https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_[YYYY-MM]/FRANCE/AIRAC-[YYYYMM]/pdf/FR-AD-2-[ICAO].pdf
```

### Exemple pour LFPG (cycle 2024-13) :
```
https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_2024-13/FRANCE/AIRAC-202413/pdf/FR-AD-2-LFPG.pdf
```

### Problèmes
- ❌ CORS bloque les requêtes depuis le navigateur
- ❌ URLs changent tous les 28 jours
- ❌ Structure peut changer sans préavis

## 🤖 Solution 4 : Scraping avec Puppeteer

### Avantages
- Contourne CORS
- Peut naviguer comme un humain
- Trouve automatiquement les bonnes URLs

### Inconvénients
- Plus lent
- Peut casser si le site change
- Nécessite Chromium

### Code exemple
```javascript
const puppeteer = require('puppeteer');

async function scrapeVAC(icao) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('https://www.sia.aviation-civile.gouv.fr');
  // Navigation et téléchargement...
  
  await browser.close();
}
```

## 💰 Solution 5 : APIs Commerciales

### Jeppesen
- **Prix** : ~5000€/an
- **API** : REST complète
- **Avantages** : Données mondiales, très fiable
- **Contact** : https://ww2.jeppesen.com

### ForeFlight
- **Prix** : ~300€/an
- **API** : Limitée aux abonnés
- **Avantages** : Interface moderne
- **Site** : https://foreflight.com

### Navigraph
- **Prix** : ~90€/an
- **API** : Orientée simulation
- **Avantages** : Mises à jour AIRAC incluses
- **Site** : https://navigraph.com

## 🔧 Configuration dans votre application

### 1. Activer le service VAC

```javascript
// src/services/vacService.js
import { vacDownloadService } from './vacDownloadService';

// Vérifier les services disponibles
const status = await vacDownloadService.checkServicesStatus();
console.log('Services disponibles:', status);

// Configurer le cycle AIRAC
const airacInfo = vacDownloadService.getAiracInfo();
console.log('Cycle AIRAC actuel:', airacInfo.current);
```

### 2. Intégrer dans le module VAC

```javascript
// Dans VACModule.jsx
const handleDownloadVAC = async (icao) => {
  try {
    // Essayer le téléchargement automatique
    const result = await vacDownloadService.downloadVAC(icao);
    
    if (result.success) {
      if (result.blob) {
        // Téléchargement réussi via proxy
        const url = URL.createObjectURL(result.blob);
        // Traiter le PDF...
      } else if (result.url) {
        // URL trouvée, ouvrir dans nouvel onglet
        window.open(result.url, '_blank');
      }
    } else {
      // Échec, proposer les liens manuels
      console.log('Liens alternatifs:', result.links);
    }
  } catch (error) {
    console.error('Erreur téléchargement:', error);
  }
};
```

## 📝 Cycle AIRAC

### Qu'est-ce que l'AIRAC ?

**AIRAC** (Aeronautical Information Regulation And Control) est un système de mise à jour standardisé :
- Cycles de **28 jours**
- **13 cycles par an**
- Changement le **jeudi**
- Planifié des années à l'avance

### Dates importantes 2024-2025

| Cycle | Date début | Date fin |
|-------|------------|----------|
| 2024-13 | 28 Nov 2024 | 25 Dec 2024 |
| 2025-01 | 26 Dec 2024 | 22 Jan 2025 |
| 2025-02 | 23 Jan 2025 | 19 Feb 2025 |
| 2025-03 | 20 Feb 2025 | 19 Mar 2025 |

## ⚠️ Limitations légales

### Important
- Les cartes VAC sont des **documents officiels**
- Usage **non commercial** uniquement
- Vérifier la **validité** avant utilisation
- Le pilote reste **responsable** de la documentation

### Recommandations
1. ✅ Toujours vérifier la date de publication
2. ✅ Comparer avec les NOTAMs
3. ✅ Avoir une copie de secours
4. ✅ Utiliser les sources officielles

## 🛠️ Dépannage

### Problème : CORS bloque les requêtes

**Solutions** :
1. Utiliser le proxy serveur
2. Extension navigateur "CORS Unblock"
3. Téléchargement manuel

### Problème : URL SIA ne fonctionne pas

**Causes possibles** :
- Cycle AIRAC a changé
- Structure URL modifiée
- Aérodrome non disponible

**Solutions** :
1. Vérifier le cycle AIRAC actuel
2. Utiliser le scraping
3. Téléchargement manuel

### Problème : Limite API atteinte

**Solutions** :
1. Implémenter un cache local
2. Utiliser plusieurs clés API
3. Espacer les requêtes

## 📚 Ressources

### Sites officiels
- [SIA France](https://www.sia.aviation-civile.gouv.fr)
- [Eurocontrol](https://www.eurocontrol.int)
- [DGAC](https://www.ecologie.gouv.fr/direction-generale-laviation-civile-dgac)

### APIs et outils
- [OpenFlightMaps](https://www.openflightmaps.org)
- [OpenAIP](https://www.openaip.net)
- [OurAirports](https://ourairports.com/data/)

### Documentation
- [AIRAC Calendar](https://www.eurocontrol.int/publication/airac-2024-2028)
- [AIP France](https://www.sia.aviation-civile.gouv.fr/aip)

## 💡 Conclusion

**Meilleure approche** :
1. **Court terme** : Import manuel + extraction PDF.js
2. **Moyen terme** : Serveur proxy local
3. **Long terme** : API commerciale si budget

L'important est d'avoir un système **fiable** et **légal** pour obtenir les cartes VAC à jour.