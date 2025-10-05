/**
 * Scripts de debug pour IndexedDB
 * À utiliser dans la console du navigateur
 */

// Fonction pour diagnostiquer IndexedDB
export async function debugIndexedDB() {
  console.log('🔍 === DEBUG INDEXEDDB ===\n');

  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('FlightManagementDB', 5);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('✅ Base de données ouverte');
    console.log('📊 Stores disponibles:', Array.from(db.objectStoreNames));

    // Vérifier aircraftData
    console.log('\n📦 === STORE: aircraftData ===');
    const aircraftTx = db.transaction(['aircraftData'], 'readonly');
    const aircraftStore = aircraftTx.objectStore('aircraftData');
    const aircraftData = await new Promise((resolve) => {
      const req = aircraftStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });

    console.log(`  Nombre d'avions: ${aircraftData.length}`);
    aircraftData.forEach(aircraft => {
      console.log(`  📋 ${aircraft.registration || aircraft.id}:`, {
        id: aircraft.id,
        hasPhoto: !!aircraft.photo,
        photoSize: aircraft.photo ? `${(aircraft.photo.length / 1024).toFixed(2)} KB` : 'N/A',
        hasManex: !!aircraft.manex,
        manexSize: aircraft.manex ? `${(JSON.stringify(aircraft.manex).length / 1024).toFixed(2)} KB` : 'N/A',
        hasPhotoFlag: aircraft.hasPhoto,
        hasManexFlag: aircraft.hasManex
      });
    });

    // Vérifier manexPDFs
    console.log('\n📚 === STORE: manexPDFs ===');
    const manexTx = db.transaction(['manexPDFs'], 'readonly');
    const manexStore = manexTx.objectStore('manexPDFs');
    const manexData = await new Promise((resolve) => {
      const req = manexStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });

    console.log(`  Nombre de MANEX: ${manexData.length}`);
    manexData.forEach(manex => {
      console.log(`  📚 ${manex.aircraftId}:`, {
        aircraftId: manex.aircraftId,
        fileName: manex.fileName,
        hasPdfData: !!manex.pdfData,
        pdfSize: manex.pdfData ? `${(manex.pdfData.length / 1024).toFixed(2)} KB` : 'N/A',
        uploadDate: manex.uploadDate
      });
    });

    db.close();

    console.log('\n✅ Diagnostic terminé');

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

// Fonction pour forcer le rechargement des photos/MANEX
export async function forceReloadData() {
  console.log('🔄 === FORCE RELOAD ===\n');

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

    console.log(`📋 ${aircraftData.length} avions trouvés dans IndexedDB`);

    // Récupérer le store Zustand
    const { useAircraftStore } = await import('../core/stores/aircraftStore');
    const { updateAircraft } = useAircraftStore.getState();

    // Mettre à jour chaque avion avec ses données volumineuses
    for (const aircraft of aircraftData) {
      if (aircraft.photo || aircraft.manex) {
        console.log(`🔄 Mise à jour de ${aircraft.registration}...`);

        const updatedAircraft = {
          ...aircraft,
          hasPhoto: !!aircraft.photo,
          hasManex: !!aircraft.manex
        };

        updateAircraft(updatedAircraft);
        console.log(`  ✅ ${aircraft.registration} mis à jour`);
      }
    }

    db.close();

    console.log('\n✅ Rechargement terminé');
    console.log('💡 Rechargez la page (F5) pour voir les changements');

  } catch (error) {
    console.error('❌ Erreur lors du rechargement:', error);
  }
}

// Exposer globalement pour la console
if (typeof window !== 'undefined') {
  window.debugIndexedDB = debugIndexedDB;
  window.forceReloadData = forceReloadData;

  console.log('🔧 Debug tools loaded:');
  console.log('  • debugIndexedDB() - Diagnostiquer IndexedDB');
  console.log('  • forceReloadData() - Forcer le rechargement des données');
}
