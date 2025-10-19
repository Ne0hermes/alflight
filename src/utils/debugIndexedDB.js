/**
 * Scripts de debug pour IndexedDB
 * À utiliser dans la console du navigateur
 */

// Fonction pour diagnostiquer IndexedDB
export async function debugIndexedDB() {
  

  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('FlightManagementDB', 5);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    

    // Vérifier aircraftData
    
    const aircraftTx = db.transaction(['aircraftData'], 'readonly');
    const aircraftStore = aircraftTx.objectStore('aircraftData');
    const aircraftData = await new Promise((resolve) => {
      const req = aircraftStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });

    
    aircraftData.forEach(aircraft => {
      .toFixed(2)} KB` : 'N/A',
        hasManex: !!aircraft.manex,
        manexSize: aircraft.manex ? `${(JSON.stringify(aircraft.manex).length / 1024).toFixed(2)} KB` : 'N/A',
        hasPhotoFlag: aircraft.hasPhoto,
        hasManexFlag: aircraft.hasManex
      });
    });

    // Vérifier manexPDFs
    
    const manexTx = db.transaction(['manexPDFs'], 'readonly');
    const manexStore = manexTx.objectStore('manexPDFs');
    const manexData = await new Promise((resolve) => {
      const req = manexStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });

    
    manexData.forEach(manex => {
      .toFixed(2)} KB` : 'N/A',
        uploadDate: manex.uploadDate
      });
    });

    db.close();

    

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

// Fonction pour forcer le rechargement des photos/MANEX
export async function forceReloadData() {
  

  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('FlightManagementDB', 5);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Récupérer tous les avions
    const tx = db.transaction(['aircraftData'], 'readonly');
    const store = tx.objectStore('aircraftData');
    const aircraftData = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
    });

    

    // Récupérer le store Zustand
    const { useAircraftStore } = await import('../core/stores/aircraftStore');
    const { updateAircraft } = useAircraftStore.getState();

    // Mettre à jour chaque avion avec ses données volumineuses
    for (const aircraft of aircraftData) {
      if (aircraft.photo || aircraft.manex) {
        

        const updatedAircraft = {
          ...aircraft,
          hasPhoto: !!aircraft.photo,
          hasManex: !!aircraft.manex
        };

        updateAircraft(updatedAircraft);
        
      }
    }

    db.close();

    
     pour voir les changements');

  } catch (error) {
    console.error('❌ Erreur lors du rechargement:', error);
  }
}

// Exposer globalement pour la console
if (typeof window !== 'undefined') {
  window.debugIndexedDB = debugIndexedDB;
  window.forceReloadData = forceReloadData;

  
   - Diagnostiquer IndexedDB');
   - Forcer le rechargement des données');
}
