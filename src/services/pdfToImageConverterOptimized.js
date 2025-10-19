// Service optimisé pour la conversion de PDFs volumineux (600+ pages)
// Avec détection intelligente et mise en cache

import * as pdfjsLib from 'pdfjs-dist';

// Configuration pour PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

class PDFToImageConverterOptimized {
  constructor() {
    // Cache pour les documents PDF chargés
    this.pdfCache = new Map();

    // Cache pour les pages converties
    this.pageImageCache = new Map();

    // Configuration de la détection
    this.performanceKeywords = {
      takeoff: {
        primary: ['take-off', 'takeoff', 'décollage', 'take off'],
        secondary: ['tod', 'todr', 'toda', 'ground roll', 'distance'],
        indicators: ['15m', '50ft', '50 ft', '15 m']
      },
      landing: {
        primary: ['landing', 'atterrissage'],
        secondary: ['ldg', 'ldr', 'lda', 'landing distance'],
        indicators: ['15m', '50ft', '50 ft', '15 m']
      },
      climb: {
        primary: ['climb', 'montée', 'rate of climb'],
        secondary: ['roc', 'ceiling', 'service ceiling'],
        indicators: ['ft/min', 'fpm', 'm/s', 'altitude']
      },
      cruise: {
        primary: ['cruise', 'croisière'],
        secondary: ['speed', 'vitesse', 'fuel consumption', 'range'],
        indicators: ['kts', 'km/h', 'l/h', 'nm']
      },
      weight: {
        primary: ['weight', 'masse', 'balance'],
        secondary: ['cg', 'center of gravity', 'loading'],
        indicators: ['kg', 'lbs', 'moment']
      }
    };

    // Limites de traitement
    this.maxPagesInMemory = 10; // Nombre max de pages en mémoire simultanément
    this.maxCacheSize = 50; // Nombre max de pages en cache
  }

  /**
   * Analyse intelligente d'un PDF volumineux
   * @param {File} pdfFile - Le fichier PDF (peut être très gros)
   * @returns {Promise<Object>} Résumé et pages pertinentes détectées
   */
  async analyzeManualPDF(pdfFile) {
    try {
      
      
      ).toFixed(2)} MB`);

      const startTime = Date.now();

      // Charger le PDF (avec mise en cache)
      const pdf = await this.loadPDF(pdfFile);
      

      // Phase 1: Scan rapide du document
      
      const tableOfContents = await this.scanTableOfContents(pdf);

      // Phase 2: Recherche des sections de performances
      
      const performanceSections = await this.findPerformanceSections(pdf, tableOfContents);

      // Phase 3: Extraction ciblée des pages pertinentes
      
      const relevantPages = await this.extractRelevantPages(pdf, performanceSections, pdfFile);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      

      return {
        fileName: pdfFile.name,
        totalPages: pdf.numPages,
        sizeInMB: (pdfFile.size / (1024 * 1024)).toFixed(2),
        tableOfContents,
        performanceSections,
        relevantPages,
        summary: {
          takeoffPages: relevantPages.filter(p => p.type === 'takeoff').length,
          landingPages: relevantPages.filter(p => p.type === 'landing').length,
          climbPages: relevantPages.filter(p => p.type === 'climb').length,
          cruisePages: relevantPages.filter(p => p.type === 'cruise').length,
          weightPages: relevantPages.filter(p => p.type === 'weight').length,
          totalRelevantPages: relevantPages.length,
          analysisTime: elapsedTime
        }
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse du PDF:', error);
      throw error;
    }
  }

  /**
   * Charge un PDF avec mise en cache
   */
  async loadPDF(pdfFile) {
    const cacheKey = `${pdfFile.name}_${pdfFile.size}`;

    if (this.pdfCache.has(cacheKey)) {
      
      return this.pdfCache.get(cacheKey);
    }

    const arrayBuffer = await this.fileToArrayBuffer(pdfFile);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Limiter la taille du cache
    if (this.pdfCache.size >= 3) {
      const firstKey = this.pdfCache.keys().next().value;
      this.pdfCache.delete(firstKey);
      
    }

    this.pdfCache.set(cacheKey, pdf);
    return pdf;
  }

  /**
   * Scan rapide de la table des matières
   */
  async scanTableOfContents(pdf) {
    const toc = [];
    const maxPagesToScan = Math.min(20, pdf.numPages); // Scanner max 20 premières pages

    for (let i = 1; i <= maxPagesToScan; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        // Rechercher des patterns de table des matières
        const tocPatterns = [
          /(\d+\.?\d*)\s*(takeoff|take-off|décollage)/gi,
          /(\d+\.?\d*)\s*(landing|atterrissage)/gi,
          /(\d+\.?\d*)\s*(performance|performances)/gi,
          /(\d+\.?\d*)\s*(climb|montée)/gi,
          /(\d+\.?\d*)\s*(cruise|croisière)/gi,
          /(\d+\.?\d*)\s*(weight|masse|balance)/gi,
          /chapter\s+(\d+)[:\s]+([\w\s]+)/gi,
          /section\s+(\d+)[:\s]+([\w\s]+)/gi
        ];

        for (const pattern of tocPatterns) {
          let match;
          while ((match = pattern.exec(pageText)) !== null) {
            toc.push({
              page: i,
              section: match[0],
              type: this.identifyContentType(match[0])
            });
          }
        }

      } catch (error) {
        
      }
    }

    
    return toc;
  }

  /**
   * Trouve les sections de performances dans le PDF
   */
  async findPerformanceSections(pdf, toc) {
    const sections = {
      takeoff: [],
      landing: [],
      climb: [],
      cruise: [],
      weight: []
    };

    // Stratégie 1: Utiliser la table des matières si disponible
    if (toc.length > 0) {
      
      for (const entry of toc) {
        if (entry.type && sections[entry.type]) {
          sections[entry.type].push(entry.page);
        }
      }
    }

    // Stratégie 2: Recherche par mots-clés (échantillonnage)
    
    const samplesToCheck = this.generateSamplePages(pdf.numPages);

    for (const pageNum of samplesToCheck) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();

        // Analyser le contenu pour chaque type
        for (const [type, keywords] of Object.entries(this.performanceKeywords)) {
          const score = this.calculateRelevanceScore(pageText, keywords);

          if (score > 0.5) { // Seuil de pertinence
            if (!sections[type].includes(pageNum)) {
              sections[type].push(pageNum);
              })`);
            }
          }
        }

      } catch (error) {
        
      }
    }

    // Étendre les sections trouvées aux pages adjacentes
    const extendedSections = this.extendSections(sections, pdf.numPages);

    return extendedSections;
  }

  /**
   * Génère un échantillon de pages à vérifier
   */
  generateSamplePages(totalPages) {
    const samples = new Set();

    // Toujours vérifier les premières et dernières pages
    for (let i = 1; i <= Math.min(5, totalPages); i++) samples.add(i);
    for (let i = Math.max(1, totalPages - 4); i <= totalPages; i++) samples.add(i);

    // Échantillonnage régulier pour les gros documents
    if (totalPages > 100) {
      // Vérifier une page tous les 10-20 pages
      const step = Math.floor(totalPages / 30); // Max 30 échantillons
      for (let i = 10; i <= totalPages; i += step) {
        samples.add(i);
      }
    } else {
      // Pour les petits documents, vérifier plus de pages
      const step = Math.max(3, Math.floor(totalPages / 20));
      for (let i = 1; i <= totalPages; i += step) {
        samples.add(i);
      }
    }

    return Array.from(samples).sort((a, b) => a - b);
  }

  /**
   * Calcule un score de pertinence pour une page
   */
  calculateRelevanceScore(pageText, keywords) {
    let score = 0;
    let maxScore = 0;

    // Mots-clés primaires (poids fort)
    for (const keyword of keywords.primary || []) {
      maxScore += 2;
      if (pageText.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    // Mots-clés secondaires (poids moyen)
    for (const keyword of keywords.secondary || []) {
      maxScore += 1;
      if (pageText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Indicateurs (poids faible)
    for (const keyword of keywords.indicators || []) {
      maxScore += 0.5;
      if (pageText.includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }

    // Bonus si la page contient des tableaux ou des nombres
    if (/\d+\s*(kg|lbs|ft|m|°c|kts)/i.test(pageText)) {
      score += 0.5;
      maxScore += 0.5;
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Étend les sections trouvées aux pages adjacentes
   */
  extendSections(sections, totalPages) {
    const extended = {};

    for (const [type, pages] of Object.entries(sections)) {
      const expandedPages = new Set(pages);

      // Pour chaque page trouvée, inclure 1-2 pages avant/après
      for (const page of pages) {
        // Page précédente
        if (page > 1) expandedPages.add(page - 1);

        // Page suivante
        if (page < totalPages) expandedPages.add(page + 1);

        // Pour les sections importantes, étendre davantage
        if (type === 'takeoff' || type === 'landing') {
          if (page > 2) expandedPages.add(page - 2);
          if (page < totalPages - 1) expandedPages.add(page + 2);
        }
      }

      extended[type] = Array.from(expandedPages).sort((a, b) => a - b);
    }

    return extended;
  }

  /**
   * Extrait les pages pertinentes identifiées
   */
  async extractRelevantPages(pdf, sections, pdfFile) {
    const relevantPages = [];
    const allPages = new Set();

    // Compiler toutes les pages uniques
    for (const pages of Object.values(sections)) {
      pages.forEach(p => allPages.add(p));
    }

    

    // Limiter l'extraction pour éviter la surcharge mémoire
    const pagesToExtract = Array.from(allPages)
      .sort((a, b) => a - b)
      .slice(0, 50); // Max 50 pages

    for (const pageNum of pagesToExtract) {
      try {
        // Vérifier le cache d'abord
        const cacheKey = `${pdfFile.name}_page_${pageNum}`;
        let base64;

        if (this.pageImageCache.has(cacheKey)) {
          base64 = this.pageImageCache.get(cacheKey);
          
        } else {
          // Convertir la page
          base64 = await this.convertPageToImage(pdf, pageNum);

          // Mettre en cache
          this.cachePageImage(cacheKey, base64);
        }

        // Déterminer le type de contenu
        const types = [];
        for (const [type, pages] of Object.entries(sections)) {
          if (pages.includes(pageNum)) {
            types.push(type);
          }
        }

        relevantPages.push({
          pageNumber: pageNum,
          base64,
          type: types[0] || 'other',
          types: types,
          confidence: types.length > 0 ? 'high' : 'medium'
        });

        })`);

      } catch (error) {
        console.error(`❌ Erreur page ${pageNum}:`, error);
      }
    }

    return relevantPages;
  }

  /**
   * Convertit une page PDF en image
   */
  async convertPageToImage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);

    // Ajuster la qualité selon l'utilisation
    const scale = 1.5; // Réduit pour économiser la mémoire
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Compression JPEG avec qualité raisonnable
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  /**
   * Met en cache une image de page avec gestion de la taille
   */
  cachePageImage(key, imageData) {
    // Nettoyer le cache si nécessaire
    if (this.pageImageCache.size >= this.maxCacheSize) {
      const keysToDelete = Array.from(this.pageImageCache.keys()).slice(0, 10);
      keysToDelete.forEach(k => this.pageImageCache.delete(k));
      
    }

    this.pageImageCache.set(key, imageData);
  }

  /**
   * Identifie le type de contenu basé sur le texte
   */
  identifyContentType(text) {
    const lowered = text.toLowerCase();

    if (lowered.includes('takeoff') || lowered.includes('take-off') || lowered.includes('décollage')) {
      return 'takeoff';
    }
    if (lowered.includes('landing') || lowered.includes('atterrissage')) {
      return 'landing';
    }
    if (lowered.includes('climb') || lowered.includes('montée')) {
      return 'climb';
    }
    if (lowered.includes('cruise') || lowered.includes('croisière')) {
      return 'cruise';
    }
    if (lowered.includes('weight') || lowered.includes('masse') || lowered.includes('balance')) {
      return 'weight';
    }

    return 'other';
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
   * Nettoie les caches
   */
  clearCache() {
    this.pdfCache.clear();
    this.pageImageCache.clear();
    
  }

  /**
   * Obtient les statistiques des caches
   */
  getCacheStats() {
    return {
      pdfCacheSize: this.pdfCache.size,
      imageCacheSize: this.pageImageCache.size,
      estimatedMemoryMB: (this.pageImageCache.size * 0.5).toFixed(1) // Estimation approximative
    };
  }

  /**
   * Vérifie si un fichier est un PDF
   */
  isPDF(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }
);}

// Export singleton
export default new PDFToImageConverterOptimized();