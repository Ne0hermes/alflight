// src/utils/pdfExtractors.js

/**
 * Module offrant différentes méthodes d'extraction de texte depuis des PDF
 * Chaque méthode a ses avantages selon le type de PDF
 */

export class PDFExtractors {
  constructor() {
    this.methods = {
      native: 'JavaScript FileReader (basique)',
      pdfjs: 'PDF.js (recommandé)',
      tesseract: 'Tesseract.js OCR (pour PDF scannés)',
      hybrid: 'Hybride (PDF.js + OCR)',
      external: 'Service externe'
    };
  }

  /**
   * Méthode 1: Extraction native basique
   * Utilise FileReader pour extraire le texte brut si présent
   */
  async extractNative(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          
          // Recherche basique de texte dans le PDF
          // Cette méthode est très limitée et ne fonctionne que pour certains PDF
          const textContent = this.extractTextFromBinary(content);
          
          resolve({
            method: 'native',
            text: textContent,
            success: textContent.length > 0,
            confidence: textContent.length > 100 ? 0.3 : 0.1
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Extrait le texte depuis le contenu binaire du PDF
   * Méthode très basique qui cherche des patterns de texte
   */
  extractTextFromBinary(content) {
    const lines = [];
    
    // Chercher les streams de texte (très basique)
    const textPattern = /\(([^)]+)\)\s*Tj/g;
    const matches = content.matchAll(textPattern);
    
    for (const match of matches) {
      if (match[1]) {
        // Décoder les caractères échappés basiques
        let text = match[1]
          .replace(/\\r/g, '\r')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        
        lines.push(text);
      }
    }
    
    // Chercher aussi les objets texte UTF-16
    const utf16Pattern = /<([0-9A-Fa-f]+)>\s*Tj/g;
    const utf16Matches = content.matchAll(utf16Pattern);
    
    for (const match of utf16Matches) {
      if (match[1]) {
        try {
          const hex = match[1];
          let text = '';
          for (let i = 0; i < hex.length; i += 4) {
            const charCode = parseInt(hex.substr(i, 4), 16);
            text += String.fromCharCode(charCode);
          }
          if (text) lines.push(text);
        } catch (e) {
          // Ignorer les erreurs de décodage
        }
      }
    }
    
    return lines.join(' ').trim();
  }

  /**
   * Méthode 2: PDF.js (Mozilla)
   * La méthode la plus fiable pour extraire le texte des PDF
   */
  async extractWithPDFJS(file) {
    // Vérifier si PDF.js est disponible
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      // Essayer de charger PDF.js dynamiquement
      try {
        await this.loadPDFJS();
      } catch (error) {
        return {
          method: 'pdfjs',
          text: '',
          success: false,
          error: 'PDF.js non disponible. Ajoutez <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>',
          confidence: 0
        };
      }
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window.pdfjsLib;
      
      // Configuration de PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      // Charger le document PDF
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const pageTexts = [];
      
      // Extraire le texte de chaque page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Construire le texte de la page
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        pageTexts.push(`--- Page ${pageNum} ---\n${pageText}`);
        fullText += pageText + '\n';
      }
      
      return {
        method: 'pdfjs',
        text: fullText,
        pages: pageTexts,
        numPages: pdf.numPages,
        success: true,
        confidence: fullText.length > 100 ? 0.9 : 0.5
      };
      
    } catch (error) {
      return {
        method: 'pdfjs',
        text: '',
        success: false,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Méthode 3: OCR avec Tesseract.js
   * Pour les PDF scannés (images)
   */
  async extractWithOCR(file) {
    // Vérifier si Tesseract est disponible
    if (typeof window !== 'undefined' && !window.Tesseract) {
      try {
        await this.loadTesseract();
      } catch (error) {
        return {
          method: 'tesseract',
          text: '',
          success: false,
          error: 'Tesseract.js non disponible. Ajoutez <script src="https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js"></script>',
          confidence: 0
        };
      }
    }
    
    try {
      // D'abord, convertir le PDF en images
      // Cette partie nécessite une bibliothèque de conversion PDF vers image
      // Pour l'instant, on retourne une erreur informative
      
      return {
        method: 'tesseract',
        text: '',
        success: false,
        error: 'L\'OCR nécessite d\'abord de convertir le PDF en images. Utilisez la méthode hybride ou un service externe.',
        confidence: 0
      };
      
    } catch (error) {
      return {
        method: 'tesseract',
        text: '',
        success: false,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Méthode 4: Approche hybride
   * Essaie d'abord PDF.js, puis OCR si nécessaire
   */
  async extractHybrid(file) {
    // Essayer d'abord avec PDF.js
    const pdfjsResult = await this.extractWithPDFJS(file);
    
    // Si PDF.js a extrait du texte significatif, le retourner
    if (pdfjsResult.success && pdfjsResult.text.length > 100) {
      return {
        ...pdfjsResult,
        method: 'hybrid-pdfjs'
      };
    }
    
    // Si peu ou pas de texte, le PDF est probablement scanné
    // Informer l'utilisateur qu'un OCR serait nécessaire
    return {
      method: 'hybrid',
      text: pdfjsResult.text || '',
      success: false,
      error: 'PDF scanné détecté. OCR nécessaire - utilisez un outil externe ou copiez/collez le texte manuellement.',
      requiresOCR: true,
      confidence: pdfjsResult.confidence
    };
  }

  /**
   * Méthode 5: API externe ou service web
   * Utilise un service externe pour l'extraction
   */
  async extractWithExternalService(file, apiKey = null) {
    // Liste des services possibles
    const services = {
      'pdf.co': {
        url: 'https://api.pdf.co/v1/pdf/convert/to/text',
        requiresKey: true
      },
      'pdfshift': {
        url: 'https://api.pdfshift.io/v3/convert/pdf',
        requiresKey: true
      },
      'local': {
        url: '/api/pdf-extract', // Endpoint local si vous avez un backend
        requiresKey: false
      }
    };
    
    // Pour l'instant, retourner une information sur l'utilisation
    return {
      method: 'external',
      text: '',
      success: false,
      error: 'Service externe non configuré. Options: pdf.co, pdfshift, ou endpoint local /api/pdf-extract',
      availableServices: Object.keys(services),
      confidence: 0
    };
  }

  /**
   * Méthode 6: Extraction avec méta-données
   * Extrait le texte ET les méta-données du PDF
   */
  async extractWithMetadata(file) {
    const result = await this.extractWithPDFJS(file);
    
    if (!result.success) {
      return result;
    }
    
    try {
      // Extraire les méta-données si PDF.js est disponible
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window.pdfjsLib;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const metadata = await pdf.getMetadata();
      
      return {
        ...result,
        method: 'metadata',
        metadata: {
          title: metadata.info?.Title || null,
          author: metadata.info?.Author || null,
          subject: metadata.info?.Subject || null,
          keywords: metadata.info?.Keywords || null,
          creator: metadata.info?.Creator || null,
          producer: metadata.info?.Producer || null,
          creationDate: metadata.info?.CreationDate || null,
          modificationDate: metadata.info?.ModDate || null
        }
      };
    } catch (error) {
      return result; // Retourner le résultat sans métadonnées en cas d'erreur
    }
  }

  /**
   * Méthode principale: tente automatiquement la meilleure méthode
   */
  async extractAuto(file, options = {}) {
    const {
      preferOCR = false,
      includeMetadata = false,
      apiKey = null
    } = options;
    
    // Si OCR préféré et disponible
    if (preferOCR) {
      const ocrResult = await this.extractWithOCR(file);
      if (ocrResult.success) return ocrResult;
    }
    
    // Essayer la méthode hybride par défaut
    const hybridResult = await this.extractHybrid(file);
    
    // Si demande de métadonnées et extraction réussie
    if (includeMetadata && hybridResult.success) {
      return await this.extractWithMetadata(file);
    }
    
    // Si échec et API key fournie, essayer service externe
    if (!hybridResult.success && apiKey) {
      return await this.extractWithExternalService(file, apiKey);
    }
    
    return hybridResult;
  }

  /**
   * Charge PDF.js dynamiquement
   */
  async loadPDFJS() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger PDF.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Charge Tesseract.js dynamiquement
   */
  async loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger Tesseract.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Nettoie et formate le texte extrait
   */
  cleanExtractedText(text) {
    return text
      .replace(/\s+/g, ' ')           // Normaliser les espaces
      .replace(/(\r\n|\n|\r)/gm, '\n') // Normaliser les retours à la ligne
      .replace(/\n{3,}/g, '\n\n')      // Limiter les sauts de ligne
      .trim();
  }

  /**
   * Analyse la qualité du texte extrait
   */
  analyzeTextQuality(text) {
    const metrics = {
      length: text.length,
      words: text.split(/\s+/).length,
      lines: text.split('\n').length,
      hasNumbers: /\d/.test(text),
      hasUpperCase: /[A-Z]/.test(text),
      hasLowerCase: /[a-z]/.test(text),
      hasPunctuation: /[.,!?;:]/.test(text),
      avgWordLength: 0,
      confidence: 0
    };
    
    // Calculer la longueur moyenne des mots
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 0) {
      metrics.avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    }
    
    // Calculer un score de confiance basé sur les métriques
    let confidence = 0;
    if (metrics.length > 100) confidence += 0.2;
    if (metrics.words > 20) confidence += 0.2;
    if (metrics.hasNumbers) confidence += 0.1;
    if (metrics.hasUpperCase && metrics.hasLowerCase) confidence += 0.2;
    if (metrics.hasPunctuation) confidence += 0.1;
    if (metrics.avgWordLength > 3 && metrics.avgWordLength < 10) confidence += 0.2;
    
    metrics.confidence = Math.min(confidence, 1);
    
    return metrics;
  }

  /**
   * Suggestions pour améliorer l'extraction
   */
  getSuggestions(result) {
    const suggestions = [];
    
    if (!result.success) {
      if (result.requiresOCR) {
        suggestions.push({
          type: 'ocr',
          message: 'Ce PDF semble être scanné. Utilisez un outil OCR comme:',
          tools: [
            'Adobe Acrobat (payant, très précis)',
            'Google Drive (gratuit, upload puis ouvrir avec Google Docs)',
            'SmallPDF.com (en ligne, gratuit avec limites)',
            'OCR.space (API gratuite)',
            'Tesseract OCR (open source, nécessite installation)'
          ]
        });
      }
      
      if (result.error?.includes('PDF.js')) {
        suggestions.push({
          type: 'library',
          message: 'PDF.js n\'est pas chargé. Ajoutez dans votre HTML:',
          code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>'
        });
      }
    } else if (result.confidence < 0.5) {
      suggestions.push({
        type: 'quality',
        message: 'La qualité d\'extraction est faible. Essayez:',
        actions: [
          'Vérifier que le PDF n\'est pas protégé',
          'Utiliser Adobe Reader pour copier/coller le texte',
          'Convertir le PDF avec un outil en ligne',
          'Demander une version texte du document'
        ]
      });
    }
    
    return suggestions;
  }
}

// Instance singleton
export const pdfExtractors = new PDFExtractors();

// Fonction helper pour utilisation rapide
export async function extractTextFromPDF(file, method = 'auto') {
  const extractor = new PDFExtractors();
  
  switch (method) {
    case 'native':
      return await extractor.extractNative(file);
    case 'pdfjs':
      return await extractor.extractWithPDFJS(file);
    case 'ocr':
      return await extractor.extractWithOCR(file);
    case 'hybrid':
      return await extractor.extractHybrid(file);
    case 'metadata':
      return await extractor.extractWithMetadata(file);
    case 'auto':
    default:
      return await extractor.extractAuto(file);
  }
}

export default pdfExtractors;