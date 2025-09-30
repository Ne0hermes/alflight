// Utilitaires pour gérer le localStorage et éviter les erreurs de quota

/**
 * Obtenir la taille utilisée du localStorage
 */
export const getLocalStorageSize = () => {
  let totalSize = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalSize += localStorage[key].length + key.length;
    }
  }
  // Convertir en MB
  return (totalSize / 1024 / 1024).toFixed(2);
};

/**
 * Obtenir la taille d'une clé spécifique
 */
export const getItemSize = (key) => {
  const item = localStorage.getItem(key);
  if (!item) return 0;
  return ((item.length + key.length) / 1024).toFixed(2); // en KB
};

/**
 * Nettoyer les vieilles données du localStorage
 */
export const cleanOldData = (aggressive = false) => {
  const keysToCheck = [
    'pilotLogbook',
    'pilotCertifications',
    'userAircraft',
    'flightPlans',
    'certifications'
  ];

  let freedSpace = 0;

  keysToCheck.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const originalSize = data.length;
        const parsed = JSON.parse(data);

        // Mode agressif : limites plus strictes
        const limit = aggressive ? 50 : 100;

        // Pour les tableaux, limiter aux derniers éléments
        if (Array.isArray(parsed) && parsed.length > limit) {
          const trimmed = parsed.slice(-limit);
          localStorage.setItem(key, JSON.stringify(trimmed));
          const newSize = localStorage.getItem(key).length;
          freedSpace += originalSize - newSize;
          console.log(`Nettoyé ${key}: gardé les ${limit} derniers éléments, libéré ${((originalSize - newSize) / 1024).toFixed(1)}KB`);
        }

        // Pour les certifications, supprimer les documents base64
        if (key === 'pilotCertifications' || key === 'certifications') {
          const cleaned = cleanCertifications(parsed, aggressive);
          localStorage.setItem(key, JSON.stringify(cleaned));
          const newSize = localStorage.getItem(key).length;
          freedSpace += originalSize - newSize;
          console.log(`Nettoyé ${key}: libéré ${((originalSize - newSize) / 1024).toFixed(1)}KB`);
        }
      }
    } catch (error) {
      console.error(`Erreur lors du nettoyage de ${key}:`, error);
    }
  });

  return freedSpace;
};

/**
 * Nettoyer les certifications (supprimer les documents selon le mode)
 */
const cleanCertifications = (certifications, aggressive = false) => {
  const maxDocSize = aggressive ? 2 * 1024 * 1024 : 5 * 1024 * 1024; // 2MB en mode agressif, 5MB sinon
  const maxTotalSize = aggressive ? 10 * 1024 * 1024 : 20 * 1024 * 1024; // 10MB ou 20MB total
  const cleaned = { ...certifications };
  let totalSize = 0;
  let removedCount = 0;

  Object.keys(cleaned).forEach(category => {
    if (Array.isArray(cleaned[category])) {
      cleaned[category] = cleaned[category].map(item => {
        if (item.document) {
          const docSize = item.document.length;
          totalSize += docSize;

          // Supprimer les documents selon le seuil
          if (docSize > maxDocSize || (aggressive && totalSize > maxTotalSize)) {
            console.log(`Document supprimé: ${item.name} (${(docSize / 1024 / 1024).toFixed(2)}MB)`);
            removedCount++;
            return { ...item, document: null, documentName: `Document supprimé (>${(maxDocSize/1024/1024).toFixed(0)}MB)` };
          }
        }
        return item;
      });
    }
  });

  // En mode agressif, supprimer TOUS les documents si l'espace est critique
  if (aggressive && totalSize > maxTotalSize) {
    console.warn(`Nettoyage agressif: suppression de tous les documents`);
    Object.keys(cleaned).forEach(category => {
      if (Array.isArray(cleaned[category])) {
        cleaned[category] = cleaned[category].map(item => ({
          ...item,
          document: null,
          documentName: item.documentName ? `[Supprimé] ${item.documentName}` : null
        }));
      }
    });
  }

  // Limiter le nombre d'entrées par catégorie
  const maxPerCategory = aggressive ? 5 : 10;
  Object.keys(cleaned).forEach(category => {
    if (Array.isArray(cleaned[category]) && cleaned[category].length > maxPerCategory) {
      cleaned[category] = cleaned[category]
        .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
        .slice(0, maxPerCategory);
    }
  });

  if (removedCount > 0) {
    console.log(`${removedCount} documents supprimés pour libérer de l'espace`);
  }

  return cleaned;
};

/**
 * Sauvegarder en toute sécurité (avec gestion du quota)
 */
export const safeSetItem = (key, value) => {
  try {
    // Première tentative
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('localStorage plein, tentative de nettoyage...');

      // Nettoyer les vieilles données - mode normal
      let freedSpace = cleanOldData(false);
      console.log(`Première phase: ${(freedSpace / 1024).toFixed(1)}KB libérés`);

      // Deuxième tentative
      try {
        localStorage.setItem(key, value);
        console.log('Sauvegarde réussie après nettoyage normal');
        return true;
      } catch (e2) {
        // Nettoyage agressif
        console.warn('Nettoyage agressif nécessaire...');
        freedSpace = cleanOldData(true);
        console.log(`Deuxième phase: ${(freedSpace / 1024).toFixed(1)}KB libérés`);

        try {
          localStorage.setItem(key, value);
          console.log('Sauvegarde réussie après nettoyage agressif');
          return true;
        } catch (e3) {
          // Dernier recours : supprimer les plus grosses clés
          const sizes = {};
          for (let k in localStorage) {
            if (localStorage.hasOwnProperty(k)) {
              sizes[k] = localStorage[k].length;
            }
          }

          // Trier par taille et supprimer les plus gros (sauf les essentiels)
          const sorted = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
          const essentialKeys = ['pilotProfile', 'personalInfo', 'unitsConfig'];

          for (let [k, size] of sorted) {
            if (!essentialKeys.includes(k) && k !== key) {
              console.log(`Suppression forcée de ${k} (${(size/1024).toFixed(1)}KB)`);
              localStorage.removeItem(k);

              // Réessayer
              try {
                localStorage.setItem(key, value);
                console.log('Sauvegarde réussie après suppression forcée');
                return true;
              } catch (e4) {
                continue; // Continuer à supprimer
              }
            }
          }

          console.error('Impossible de sauvegarder, même après nettoyage complet');
          alert('Espace de stockage insuffisant. Utilisez le bouton "Nettoyer le stockage" pour libérer de l\'espace.');
          return false;
        }
      }
    }
    throw e; // Autre erreur
  }
};

/**
 * Afficher les statistiques de stockage
 */
export const showStorageStats = () => {
  const stats = [];
  let total = 0;

  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const size = localStorage[key].length + key.length;
      stats.push({ key, size: (size / 1024).toFixed(1) + ' KB' });
      total += size;
    }
  }

  stats.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));

  console.table(stats.slice(0, 10)); // Top 10
  console.log(`Total utilisé: ${(total / 1024 / 1024).toFixed(2)} MB`);

  return {
    items: stats,
    totalMB: (total / 1024 / 1024).toFixed(2),
    totalKB: (total / 1024).toFixed(0)
  };
};

/**
 * Compresser une image base64 avec compression adaptative
 */
export const compressImage = (base64String, maxWidth = 800, targetQuality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;

      // Réduire la résolution si nécessaire
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Optimisations du contexte
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Dessiner l'image
      ctx.drawImage(img, 0, 0, width, height);

      // Essayer différentes qualités pour atteindre la taille cible
      let quality = targetQuality;
      let compressed = canvas.toDataURL('image/jpeg', quality);

      // Si encore trop gros, réduire la qualité progressivement
      const maxSize = 1.5 * 1024 * 1024; // 1.5MB max après compression
      while (compressed.length > maxSize && quality > 0.3) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      // Log de la compression
      const originalSizeMB = (base64String.length / 1024 / 1024).toFixed(2);
      const compressedSizeMB = (compressed.length / 1024 / 1024).toFixed(2);
      const reduction = ((1 - compressed.length / base64String.length) * 100).toFixed(0);
      console.log(`Compression: ${originalSizeMB}MB → ${compressedSizeMB}MB (-${reduction}%) [Qualité: ${quality.toFixed(1)}]`);

      resolve(compressed);
    };

    img.onerror = () => {
      console.error('Erreur lors du chargement de l\'image pour compression');
      resolve(base64String); // Retourner l'original en cas d'erreur
    };
    img.src = base64String;
  });
};

/**
 * Nettoyer manuellement le stockage (pour l'utilisateur)
 */
export const manualCleanStorage = () => {
  console.log('=== NETTOYAGE MANUEL DU STOCKAGE ===');

  // Afficher l'état avant nettoyage
  const beforeStats = showStorageStats();
  const beforeSize = parseFloat(beforeStats.totalMB);

  // Phase 1: Nettoyage normal
  console.log('\n📋 Phase 1: Nettoyage standard...');
  let freedSpace = cleanOldData(false);

  // Phase 2: Nettoyage agressif si nécessaire
  const afterPhase1 = getLocalStorageSize();
  if (parseFloat(afterPhase1) > 2.5) { // Plus agressif: si > 2.5MB
    console.log('\n🔥 Phase 2: Nettoyage agressif...');
    freedSpace += cleanOldData(true);
  }

  // Phase 3: Suppression des clés non essentielles
  console.log('\n🗑️ Phase 3: Suppression des données non essentielles...');
  const nonEssentialKeys = [
    'flightPlans',
    'vacFavorites',
    'customVacData',
    'tempData',
    'cache',
    'drafts',
    'currentFlightPlan',
    'weatherCache',
    'mapCache'
  ];

  nonEssentialKeys.forEach(key => {
    const item = localStorage.getItem(key);
    if (item) {
      const size = item.length;
      localStorage.removeItem(key);
      freedSpace += size;
      console.log(`Supprimé: ${key} (${(size/1024).toFixed(1)}KB)`);
    }
  });

  // Phase 4: Suppression ultra-agressive si toujours > 3.5MB
  const afterPhase3 = getLocalStorageSize();
  if (parseFloat(afterPhase3) > 3.5) {
    console.log('\n💥 Phase 4: Nettoyage ULTRA-AGRESSIF...');

    // Supprimer TOUS les documents des certifications
    const certs = localStorage.getItem('pilotCertifications');
    if (certs) {
      const parsed = JSON.parse(certs);
      Object.keys(parsed).forEach(category => {
        if (Array.isArray(parsed[category])) {
          parsed[category] = parsed[category].map(item => ({
            ...item,
            document: null,
            documentName: item.documentName ? '[Supprimé pour libérer espace]' : null
          }));
        }
      });
      localStorage.setItem('pilotCertifications', JSON.stringify(parsed));
      console.log('Tous les documents des certifications supprimés');
    }

    // Limiter drastiquement les carnets de vol
    const logbook = localStorage.getItem('pilotLogbook');
    if (logbook) {
      const parsed = JSON.parse(logbook);
      if (parsed.length > 20) {
        const kept = parsed.slice(-20); // Garder seulement les 20 derniers
        localStorage.setItem('pilotLogbook', JSON.stringify(kept));
        console.log(`Carnet de vol réduit à 20 entrées (de ${parsed.length})`);
      }
    }
  }

  // Afficher le résultat
  const afterStats = showStorageStats();
  const afterSize = parseFloat(afterStats.totalMB);
  const totalFreed = beforeSize - afterSize;

  console.log('\n✅ NETTOYAGE TERMINÉ');
  console.log(`Espace libéré: ${totalFreed.toFixed(2)}MB`);
  console.log(`Avant: ${beforeSize.toFixed(2)}MB → Après: ${afterSize.toFixed(2)}MB`);

  return {
    success: true,
    freedMB: totalFreed.toFixed(2),
    beforeMB: beforeSize.toFixed(2),
    afterMB: afterSize.toFixed(2),
    message: `${totalFreed.toFixed(2)}MB libérés`
  };
};

/**
 * Vérifier si le stockage est plein
 */
export const isStorageFull = () => {
  const size = parseFloat(getLocalStorageSize());
  return size > 4.5; // Considérer plein si > 4.5MB (limite navigateur ~5MB)
};

/**
 * Obtenir des recommandations de nettoyage
 */
export const getCleanupRecommendations = () => {
  const stats = showStorageStats();
  const recommendations = [];

  stats.items.forEach(item => {
    const sizeKB = parseFloat(item.size);
    if (sizeKB > 500) { // Si > 500KB
      if (item.key.includes('certification') || item.key.includes('document')) {
        recommendations.push({
          key: item.key,
          size: item.size,
          action: 'Contient probablement des documents - nettoyer les anciens'
        });
      } else if (item.key.includes('logbook')) {
        recommendations.push({
          key: item.key,
          size: item.size,
          action: 'Historique de vols - exporter et archiver les anciens'
        });
      }
    }
  });

  return recommendations;
};

/**
 * Nettoyer TOUT le localStorage sauf les données essentielles
 */
export const emergencyCleanup = () => {
  console.log('🚨 NETTOYAGE D\'URGENCE ACTIVÉ');

  // Sauvegarder les données essentielles
  const essentialData = {
    pilotProfile: localStorage.getItem('pilotProfile'),
    personalInfo: localStorage.getItem('personalInfo'),
    unitsConfig: localStorage.getItem('unitsConfig')
  };

  // Effacer TOUT
  localStorage.clear();
  console.log('Tout le localStorage a été vidé');

  // Restaurer les données essentielles
  Object.entries(essentialData).forEach(([key, value]) => {
    if (value) {
      localStorage.setItem(key, value);
      console.log(`Restauré: ${key}`);
    }
  });

  const afterSize = getLocalStorageSize();
  console.log(`Nettoyage terminé. Nouvel espace utilisé: ${afterSize}MB`);

  return {
    success: true,
    message: 'Nettoyage d\'urgence effectué. Toutes les données non essentielles ont été supprimées.',
    newSize: afterSize
  };
};

export default {
  getLocalStorageSize,
  getItemSize,
  cleanOldData,
  safeSetItem,
  showStorageStats,
  compressImage,
  manualCleanStorage,
  isStorageFull,
  getCleanupRecommendations,
  emergencyCleanup
};