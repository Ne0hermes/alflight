/**
 * Service de stockage des PDF VAC dans IndexedDB
 * Permet de stocker et récupérer des fichiers PDF volumineux
 */

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

      const record = {
        icao: icao.toUpperCase(),
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

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(icao.toUpperCase());

      request.onsuccess = () => {
        if (request.result) {
          console.log(`✅ PDF VAC ${icao} récupéré`);
          resolve(request.result);
        } else {
          console.log(`⚠️ Aucun PDF VAC trouvé pour ${icao}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`❌ Erreur récupération PDF ${icao}:`, request.error);
        reject(request.error);
      };
    });
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
      const request = objectStore.delete(icao.toUpperCase());

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
        // Retourner seulement les métadonnées (pas les blobs)
        const metadata = request.result.map(record => ({
          icao: record.icao,
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
