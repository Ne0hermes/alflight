// src/services/pdfToImageConverter.js
import * as pdfjsLib from 'pdfjs-dist';

// Configuration pour PDF.js - utiliser le worker local
// Le fichier worker est copié dans le dossier public
if (typeof window !== 'undefined') {
  // En environnement browser - utiliser le worker local
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
} else {
  // Node.js environment
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/**
 * Service de conversion PDF vers images pour l'analyse IA
 * Version avancée avec extraction de toutes les pages
 */
class PDFToImageConverter {
  /**
   * Convertit un fichier PDF en images
   * @param {File} pdfFile - Le fichier PDF à convertir
   * @param {number} pageNumber - Numéro de page à extraire (optionnel, par défaut 1)
   * @returns {Promise<string>} Image en base64
   */
  async convertPDFToImage(pdfFile, pageNumber = 1) {
    try {
      console.log(`📄 Conversion PDF: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(2)} KB)`);

      // Lire le fichier PDF
      const arrayBuffer = await this.fileToArrayBuffer(pdfFile);
      
      // Charger le document PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      // Vérifier que la page demandée existe
      if (pageNumber > pdf.numPages || pageNumber < 1) {
        throw new Error(`Page ${pageNumber} n'existe pas. Le PDF contient ${pdf.numPages} page(s).`);
      }
      
      // Obtenir la page spécifique
      const page = await pdf.getPage(pageNumber);
      
      // Définir l'échelle pour une bonne qualité (2 = 200% de la taille originale)
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      // Créer un canvas pour le rendu
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      console.log(`Rendering page ${pageNumber}...`);

      // Rendre la page PDF sur le canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;

      // Convertir le canvas en base64
      const base64Image = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

      console.log(`✅ Image convertie: ${(base64Image.length / 1024).toFixed(2)} KB)`);

      return base64Image;
      
    } catch (error) {
      console.error('❌ Erreur lors de la conversion PDF:', error);
      throw new Error(`Conversion PDF échouée: ${error.message}`);
    }
  }
  
  /**
   * Extrait toutes les pages d'un PDF sous forme d'images
   * @param {File} pdfFile - Le fichier PDF
   * @param {number} maxPages - Nombre maximum de pages à extraire (par défaut 5)
   * @returns {Promise<Array>} Tableau d'images en base64
   */
  async extractAllPages(pdfFile, maxPages = 5) {
    try {
      const arrayBuffer = await this.fileToArrayBuffer(pdfFile);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const numPages = Math.min(pdf.numPages, maxPages);
      const images = [];

      console.log(`📄 Extraction de ${numPages} page(s) du PDF...`);

      for (let i = 1; i <= numPages; i++) {
        const image = await this.convertPDFToImage(pdfFile, i);
        images.push({
          pageNumber: i,
          base64: image
        });
      }
      
      return images;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'extraction des pages:', error);
      throw error;
    }
  }
  
  /**
   * Trouve la page contenant un tableau de performances
   * @param {File} pdfFile - Le fichier PDF
   * @param {string} tableType - Type de tableau ('takeoff' ou 'landing')
   * @returns {Promise<Object>} Page trouvée avec son image
   */
  async findPerformanceTablePage(pdfFile, tableType = 'takeoff') {
    try {
      
      
      const arrayBuffer = await this.fileToArrayBuffer(pdfFile);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Mots-clés à rechercher selon le type
      const keywords = tableType === 'takeoff' ? 
        ['take-off', 'takeoff', 'décollage', 'tod', 'todr', 'toda'] :
        ['landing', 'atterrissage', 'ldg', 'ldr', 'lda'];
      
      // Parcourir les pages pour trouver le tableau
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();
        
        // Vérifier si la page contient des mots-clés
        const hasKeywords = keywords.some(keyword => pageText.includes(keyword));
        
        if (hasKeywords && (pageText.includes('kg') || pageText.includes('lbs')) && 
            (pageText.includes('°c') || pageText.includes('ft') || pageText.includes('altitude'))) {
          
          const image = await this.convertPDFToImage(pdfFile, pageNum);
          return {
            pageNumber: pageNum,
            base64: image,
            type: tableType
          };
        }
      }
      
      
      const image = await this.convertPDFToImage(pdfFile, 1);
      return {
        pageNumber: 1,
        base64: image,
        type: tableType,
        warning: 'Tableau non détecté automatiquement'
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la recherche du tableau:', error);
      throw error;
    }
  }
  
  /**
   * Convertit un fichier en ArrayBuffer
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Extrait toutes les pages d'un PDF vers des images
   * @param {File} pdfFile - Le fichier PDF à convertir
   * @returns {Promise<Array>} Array d'objets {pageNumber, base64, size}
   */
  async extractAllPages(pdfFile) {
    try {
      console.log(`📄 Extraction de toutes les pages du PDF: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(2)} KB)`);

      const arrayBuffer = await this.fileToArrayBuffer(pdfFile);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Configuration du rendu - résolution élevée pour l'IA
          const scale = 2.0; // Augmenter pour plus de qualité
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          console.log(`🔄 Rendu de la page ${pageNum}...`);

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          await page.render(renderContext).promise;
          
          // Conversion en base64 avec qualité optimisée pour l'IA
          const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
          const sizeKB = Math.round((base64.length * 3/4) / 1024);
          pages.push({
            pageNumber: pageNum,
            base64: base64,
            size: sizeKB,
            dimensions: {
              width: viewport.width,
              height: viewport.height
            }
          });
          
        } catch (pageError) {
          console.error(`❌ Erreur lors du traitement de la page ${pageNum}:`, pageError);
          // Continuer avec les autres pages
        }
      }
      
      
      return pages;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'extraction des pages:', error);
      throw new Error(`Erreur d'extraction: ${error.message}`);
    }
  }

  /**
   * Vérifie si un fichier est un PDF
   */
  isPDF(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }
}

// Export singleton
export default new PDFToImageConverter();