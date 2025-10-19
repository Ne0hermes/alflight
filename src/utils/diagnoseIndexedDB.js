/**
 * Script de diagnostic et réparation d'IndexedDB
 */

export async function diagnoseIndexedDB() {
  

  // 1. Vérifier le support
  if (!window.indexedDB) {
    console.error('❌ IndexedDB non supporté par ce navigateur');
    return { supported: false };
  }
  

  // 2. Lister toutes les bases de données
  try {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();

    } else {
      console.log('indexedDB.databases() non disponible');
    }
  } catch (error) {
    
  }

  // 3. Tester l'ouverture de FlightManagementDB
  const DB_NAME = 'FlightManagementDB';
  

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);

    const timeout = setTimeout(() => {
      console.error('❌ TIMEOUT lors de l\'ouverture de la base (10s)');
      resolve({
        supported: true,
        canOpen: false,
        error: 'Timeout',
        recommendation: 'Supprimer et recréer la base'
      });
    }, 10000);

    request.onerror = (event) => {
      clearTimeout(timeout);
      console.error('❌ Erreur lors de l\'ouverture:', event.target.error);
      console.error('   Code:', event.target.error?.code);
      console.error('   Name:', event.target.error?.name);
      console.error('   Message:', event.target.error?.message);

      resolve({
        supported: true,
        canOpen: false,
        error: event.target.error,
        recommendation: 'Supprimer et recréer la base'
      });
    };

    request.onsuccess = (event) => {
      clearTimeout(timeout);
      const db = event.target.result;
      
      

      // Vérifier les stores attendus
      const expectedStores = [
        'dataBackups',
        'protectedData',
        'aircraftData',
        'vfrPoints',
        'navigationData'
      ];

      const missingStores = expectedStores.filter(store => !db.objectStoreNames.contains(store));

      if (missingStores.length > 0) {
        
      } else {
        
      }

      db.close();

      resolve({
        supported: true,
        canOpen: true,
        version: db.version,
        stores: Array.from(db.objectStoreNames),
        missingStores,
        healthy: missingStores.length === 0
      });
    };

    request.onblocked = (event) => {
      clearTimeout(timeout);
      
      resolve({
        supported: true,
        canOpen: false,
        error: 'Blocked',
        recommendation: 'Fermer les autres onglets et réessayer'
      });
    };
  });
}

export async function deleteAndRecreateDB() {
  

  const DB_NAME = 'FlightManagementDB';

  return new Promise((resolve, reject) => {
    
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onerror = (event) => {
      console.error('❌ Erreur lors de la suppression:', event.target.error);
      reject(event.target.error);
    };

    deleteRequest.onsuccess = () => {
      
      
      resolve(true);

      // Recharger après 1 seconde
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    deleteRequest.onblocked = () => {
      
      alert('Fermez tous les autres onglets de cette application, puis réessayez.');
      reject(new Error('Blocked'));
    };
  });
}

// Fonction rapide pour diagnostiquer et proposer une solution
export async function autoFixIndexedDB() {
  

  const diagnosis = await diagnoseIndexedDB();

  if (!diagnosis.supported) {
    alert('❌ Votre navigateur ne supporte pas IndexedDB.\nVeuillez utiliser un navigateur moderne (Chrome, Firefox, Edge, Safari).');
    return false;
  }

  if (!diagnosis.canOpen) {
    
    

    const confirm = window.confirm(
      '⚠️  La base de données IndexedDB est corrompue.\n\n' +
      'Voulez-vous la supprimer et la recréer ?\n\n' +
      '⚠️  ATTENTION: Cette action supprimera les données stockées localement.\n' +
      'Assurez-vous d\'avoir exporté vos données importantes avant de continuer.'
    );

    if (confirm) {
      await deleteAndRecreateDB();
      return true;
    }
    return false;
  }

  if (!diagnosis.healthy) {
    
    

    const confirm = window.confirm(
      '⚠️  La base de données est incomplète.\n\n' +
      `Stores manquants: ${diagnosis.missingStores.join(', ')}\n\n` +
      'Voulez-vous recréer la base ?'
    );

    if (confirm) {
      await deleteAndRecreateDB();
      return true;
    }
    return false;
  }

  
  alert('✅ La base de données IndexedDB fonctionne correctement.');
  return true;
}

// Exposer globalement pour debug dans la console
if (typeof window !== 'undefined') {
  window.diagnoseIndexedDB = diagnoseIndexedDB;
  window.deleteAndRecreateDB = deleteAndRecreateDB;
  window.autoFixIndexedDB = autoFixIndexedDB;
}
