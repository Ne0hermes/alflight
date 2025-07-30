// src/core/stores/vacStore.js (mise à jour)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { SIAVACExtractor } from '@services/vacPdfExtractor';

// Configuration des cartes VAC avec URLs réelles
export const VAC_CONFIG = {
  baseUrl: 'https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_28_NOV_2024/FRANCE/AIRAC-2024-11-28/pdf/FR-AD-2',
  charts: {
    'LFPN': { 
      url: 'AD-2.LFPN-fr-FR.pdf',
      name: 'Toussus-le-Noble',
      coordinates: { lat: 48.7519, lon: 2.1061 }
    },
    'LFPT': { 
      url: 'AD-2.LFPT-fr-FR.pdf',
      name: 'Pontoise-Cormeilles',
      coordinates: { lat: 49.0968, lon: 2.0413 }
    },
    'LFST': {
      url: 'AD-2.LFST-fr-FR.pdf',
      name: 'Strasbourg-Entzheim',
      coordinates: { lat: 48.5444, lon: 7.6283 }
    },
    'LFPG': { 
      url: 'AD-2.LFPG-fr-FR.pdf',
      name: 'Paris Charles de Gaulle',
      coordinates: { lat: 49.0097, lon: 2.5479 }
    },
    // ... autres aéroports
  }
};

export const useVACStore = create(
  persist(
    immer((set, get) => ({
      // État existant...
      charts: {},
      downloading: {},
      errors: {},
      selectedChart: null,
      
      // Nouvelle action pour télécharger réellement
      downloadChart: async (icao) => {
        const upperIcao = icao.toUpperCase();
        const chartConfig = VAC_CONFIG.charts[upperIcao];
        
        if (!chartConfig) {
          set(state => {
            state.errors[upperIcao] = 'Aéroport non disponible';
          });
          return false;
        }
        
        set(state => {
          state.downloading[upperIcao] = true;
          delete state.errors[upperIcao];
        });
        
        try {
          console.log(`📥 Téléchargement carte VAC ${upperIcao}...`);
          
          // URL complète
          const pdfUrl = `${VAC_CONFIG.baseUrl}/${chartConfig.url}`;
          
          // Pour contourner CORS, utiliser un proxy ou télécharger via backend
          // Option 1: Proxy CORS (pour développement)
          const proxyUrl = `https://cors-anywhere.herokuapp.com/${pdfUrl}`;
          
          // Option 2: Votre propre proxy
          // const proxyUrl = `/api/vac-proxy?url=${encodeURIComponent(pdfUrl)}`;
          
          const response = await fetch(proxyUrl, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
          }
          
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const pdfData = new Uint8Array(arrayBuffer);
          
          // Créer URL pour affichage
          const blobUrl = URL.createObjectURL(blob);
          
          // Extraire les données avec le nouvel extracteur
          const extractor = new SIAVACExtractor();
          const extractedData = await extractor.extractFromPDF(pdfData);
          
          set(state => {
            state.charts[upperIcao] = {
              icao: upperIcao,
              name: chartConfig.name,
              url: pdfUrl,
              coordinates: chartConfig.coordinates,
              isDownloaded: true,
              downloadDate: Date.now(),
              fileSize: (blob.size / 1024 / 1024).toFixed(2), // MB
              pdfBlob: blob,
              pdfUrl: blobUrl,
              extractedData: extractedData
            };
            delete state.downloading[upperIcao];
          });
          
          console.log(`✅ Carte VAC ${upperIcao} téléchargée et analysée`);
          return true;
          
        } catch (error) {
          console.error(`❌ Erreur téléchargement ${upperIcao}:`, error);
          set(state => {
            state.errors[upperIcao] = error.message;
            delete state.downloading[upperIcao];
          });
          return false;
        }
      },
      
      // Ouvrir le PDF dans un nouvel onglet
      openPDF: (icao) => {
        const chart = get().charts[icao?.toUpperCase()];
        if (chart?.pdfUrl) {
          window.open(chart.pdfUrl, '_blank');
        } else if (chart?.url) {
          window.open(chart.url, '_blank');
        }
      },
      
      // Télécharger le PDF sur l'ordinateur
      savePDF: (icao) => {
        const chart = get().charts[icao?.toUpperCase()];
        if (chart?.pdfBlob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(chart.pdfBlob);
          a.download = `VAC_${icao}_${new Date().toISOString().split('T')[0]}.pdf`;
          a.click();
        }
      }
    }))
  )
);