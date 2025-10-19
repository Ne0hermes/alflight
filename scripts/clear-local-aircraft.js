/**
 * Script pour vider le localStorage des avions
 * Usage: Exécuter ce script dans la console du navigateur
 * ou l'utiliser via un bouton dans l'interface
 */

console.log('🗑️  Nettoyage du localStorage des avions...\n');

// Supprimer le store Zustand des avions
const aircraftStorageKey = 'aircraft-storage';
const oldData = localStorage.getItem(aircraftStorageKey);

if (oldData) {
  const parsed = JSON.parse(oldData);
  console.log('📋 Données actuelles:', {
    aircraftCount: parsed.state?.aircraftList?.length || 0,
    aircraft: parsed.state?.aircraftList?.map(a => a.registration) || []
  });

  // Sauvegarder une copie avant suppression
  const backup = {
    timestamp: new Date().toISOString(),
    data: parsed
  };
  localStorage.setItem('aircraft-storage-backup', JSON.stringify(backup));
  console.log('💾 Backup créé: aircraft-storage-backup');
}

// Réinitialiser le store avec une liste vide
const emptyStore = {
  state: {
    aircraftList: [],
    selectedAircraftId: null
  },
  version: 0
};

localStorage.setItem(aircraftStorageKey, JSON.stringify(emptyStore));
console.log('✅ localStorage nettoyé!');
console.log('🔄 Rechargez la page pour voir les changements');

export function clearLocalAircraft() {
  const aircraftStorageKey = 'aircraft-storage';

  // Créer un backup
  const oldData = localStorage.getItem(aircraftStorageKey);
  if (oldData) {
    const backup = {
      timestamp: new Date().toISOString(),
      data: JSON.parse(oldData)
    };
    localStorage.setItem('aircraft-storage-backup', JSON.stringify(backup));
  }

  // Réinitialiser
  const emptyStore = {
    state: {
      aircraftList: [],
      selectedAircraftId: null
    },
    version: 0
  };

  localStorage.setItem(aircraftStorageKey, JSON.stringify(emptyStore));

  return {
    success: true,
    message: 'localStorage nettoyé avec succès',
    backupKey: 'aircraft-storage-backup'
  };
}
