/**
 * Service de stockage des PDF VAC dans IndexedDB
 * Permet de stocker et récupérer des fichiers PDF volumineux
 */

// 🔐 Cloisonnement par compte : la clé de stockage est préfixée par le
// propriétaire courant des données locales (même marqueur que les coffres du
// profil et que les avions). Les cartes d'un autre pilote deviennent
// invisibles ET ne peuvent plus être écrasées.
const currentOwner = () => {
  try { return localStorage.getItem('alflight:data-owner') || null; } catch { return null; }
};
const scopedKey = (icao) => {
  const owner = currentOwner();
  const upper = String(icao || '').toUpperCase();
  return owner ? `${owner}::${upper}` : upper;
};

const DB_NAME = 'vac-pdf-storage';
const DB_VERSION = 1;
const STORE_NAME = 'vac-pdfs';

class VACPdfStorage {
  constructor() {
    this.db = null;
  }

  /**
   * Initialise la base de données IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ Erreur ouverture IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialisée pour stockage VAC PDF');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Créer l'object store si n'existe pas
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'icao' });
          objectStore.createIndex('icao', 'icao', { unique: true });
          objectStore.createIndex('uploadDate', 'uploadDate', { unique: false });
          console.log('✅ Object store VAC PDF créé');
        }
      };
    });
  }

  /**
   * Assure que la DB est initialisée
   */
  async ensureInitialized() {
    if (!this.db) {
      await this.init();
    }
  }

  /**
   * Stocke un PDF VAC dans IndexedDB
   * @param {string} icao - Code ICAO de l'aérodrome
   * @param {File} pdfFile - Fichier PDF à stocker
   * @returns {Promise<void>}
   */
  async storePDF(icao, pdfFile) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      const upper = icao.toUpperCase();
      const record = {
        // 🔐 CLOISONNEMENT PAR COMPTE (16/08) : la clé porte le compte
        // propriétaire. Sans cela, deux pilotes du même appareil partageaient
        // le MÊME fichier par code OACI — et le second écrasait la carte du
        // premier. L'API publique reste inchangée (on passe toujours un OACI).
        icao: scopedKey(upper),
        airportIcao: upper,
        ownerAccountId: currentOwner(),
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        fileType: pdfFile.type,
        pdfBlob: pdfFile, // Stocke le File/Blob directement
        uploadDate: new Date().toISOString()
      };

      const request = objectStore.put(record);

      request.onsuccess = () => {
        console.log(`✅ PDF VAC ${icao} stocké (${(pdfFile.size / 1024).toFixed(1)} KB)`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Erreur stockage PDF ${icao}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Récupère un PDF VAC depuis IndexedDB
   * @param {string} icao - Code ICAO de l'aérodrome
   * @returns {Promise<Object|null>} - Objet avec {icao, fileName, pdfBlob, uploadDate} ou null
   */
  async getPDF(icao) {
    await this.ensureInitialized();
    const upper = String(icao || '').toUpperCase();

    const readKey = (key) => new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    // Format normalisé : l'appelant voit toujours un code OACI, jamais la clé.
    const normalize = (rec) => (rec ? { ...rec, icao: rec.airportIcao || upper } : null);

    try {
      const scoped = await readKey(scopedKey(upper));
      if (scoped) return normalize(scoped);

      // 🔁 ADOPTION des cartes d'AVANT le cloisonnement : une carte sans
      // propriétaire appartient au compte courant (même convention que les
      // avions). On la re-range sous sa clé cloisonnée, jamais on ne la perd.
      const legacy = await readKey(upper);
      if (legacy && !legacy.ownerAccountId) {
        const owner = currentOwner();
        if (owner) {
          await new Promise((resolve) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ ...legacy, icao: scopedKey(upper), airportIcao: upper, ownerAccountId: owner });
            store.delete(upper);
            tx.oncomplete = resolve;
            tx.onerror = resolve; // adoption best effort
          });
          console.log(`🔐 Carte VAC ${upper} rattachée au compte courant`);
        }
        return normalize(legacy);
      }

      console.log(`⚠️ Aucun PDF VAC trouvé pour ${upper}`);
      return null;
    } catch (error) {
      console.error(`❌ Erreur récupération PDF ${upper}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si un PDF existe pour un aérodrome
   * @param {string} icao - Code ICAO
   * @returns {Promise<boolean>}
   */
  async hasPDF(icao) {
    const pdf = await this.getPDF(icao);
    return pdf !== null;
  }

  /**
   * Supprime un PDF VAC
   * @param {string} icao - Code ICAO
   * @returns {Promise<void>}
   */
  async deletePDF(icao) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      // Ne supprime QUE la carte du compte courant (clé cloisonnée) : un
      // pilote ne peut pas effacer celle d'un autre profil de l'appareil.
      const request = objectStore.delete(scopedKey(icao));

      request.onsuccess = () => {
        console.log(`✅ PDF VAC ${icao} supprimé`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Erreur suppression PDF ${icao}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Liste tous les PDF VAC stockés
   * @returns {Promise<Array>} - Liste des métadonnées (sans les blobs)
   */
  async listAllPDFs() {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        // Retourner seulement les métadonnées (pas les blobs), et UNIQUEMENT
        // les cartes du compte courant (+ les héritées, non encore adoptées).
        const owner = currentOwner();
        const metadata = request.result
          .filter(r => !r.ownerAccountId || !owner || r.ownerAccountId === owner)
          .map(record => ({
            icao: record.airportIcao || record.icao,
            fileName: record.fileName,
            fileSize: record.fileSize,
            uploadDate: record.uploadDate
          }));
        resolve(metadata);
      };

      request.onerror = () => {
        console.error('❌ Erreur listage PDF:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Crée une URL blob pour afficher le PDF
   * @param {string} icao - Code ICAO
   * @returns {Promise<string|null>} - URL blob ou null
   */
  async getPDFUrl(icao) {
    const record = await this.getPDF(icao);
    if (record && record.pdfBlob) {
      return URL.createObjectURL(record.pdfBlob);
    }
    return null;
  }

  /**
   * Obtient la taille totale utilisée
   * @returns {Promise<number>} - Taille en bytes
   */
  async getTotalSize() {
    const pdfs = await this.listAllPDFs();
    return pdfs.reduce((total, pdf) => total + (pdf.fileSize || 0), 0);
  }
}

// Export singleton
export const vacPdfStorage = new VACPdfStorage();
export default vacPdfStorage;
