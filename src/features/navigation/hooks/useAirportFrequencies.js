import { useState, useEffect } from 'react';
import { aixmParser } from '@services/aixmParser';

/**
 * Hook pour récupérer les fréquences d'un aérodrome
 * @param {string} icao - Code ICAO de l'aérodrome
 * @returns {Array} Liste des fréquences
 */
export const useAirportFrequencies = (icao) => {
  const [frequencies, setFrequencies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao) {
      setFrequencies([]);
      return;
    }

    const loadFrequencies = async () => {
      setLoading(true);
      try {
        // Charger toutes les données si nécessaire
        const aerodromes = await aixmParser.loadAndParse();
        
        // Trouver l'aérodrome spécifique
        const aerodrome = aerodromes.find(ad => ad.icao === icao);
        
        if (aerodrome && aerodrome.frequencies) {
          // Filtrer et ordonner les fréquences importantes
          const priorityOrder = ['twr', 'app', 'gnd', 'atis', 'afis', 'info'];
          const sortedFreqs = aerodrome.frequencies.sort((a, b) => {
            const indexA = priorityOrder.indexOf(a.type);
            const indexB = priorityOrder.indexOf(b.type);
            
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            
            return indexA - indexB;
          });
          
          setFrequencies(sortedFreqs);
        } else {
          setFrequencies([]);
        }
      } catch (error) {
        console.error(`Erreur chargement fréquences pour ${icao}:`, error);
        setFrequencies([]);
      } finally {
        setLoading(false);
      }
    };

    loadFrequencies();
  }, [icao]);

  return { frequencies, loading };
};

/**
 * Fonction pour récupérer les fréquences synchrone depuis le cache
 */
export const getAirportFrequenciesSync = async (icao) => {
  if (!icao) return [];
  
  try {
    const aerodromes = await aixmParser.loadAndParse();
    const aerodrome = aerodromes.find(ad => ad.icao === icao);
    
    if (aerodrome && aerodrome.frequencies) {
      // Retourner les fréquences principales (TWR et APP)
      return aerodrome.frequencies.filter(f => 
        f.type === 'twr' || f.type === 'app' || f.type === 'atis'
      );
    }
  } catch (error) {
    console.error(`Erreur récupération fréquences ${icao}:`, error);
  }
  
  return [];
};