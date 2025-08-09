// Composant React pour intégrer la couche des aérodromes OpenAIP
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import OpenAIPAirportsLayer from '../../../map/layers/OpenAIPAirportsLayer';

const AirportsLayer = ({ enabled = true }) => {
  const map = useMap();
  const layerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Créer la couche une seule fois au montage
    if (!initializedRef.current && map) {
      console.log('🛫 Initialisation de la couche des aérodromes OpenAIP');
      layerRef.current = new OpenAIPAirportsLayer(map, {
        minZoom: 6,
        debounceDelay: 400,
        clusteringThreshold: 100
      });
      initializedRef.current = true;
    }

    // Cleanup on unmount
    return () => {
      if (layerRef.current) {
        console.log('🛬 Destruction de la couche des aérodromes');
        layerRef.current.destroy();
        layerRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [map]); // Ne dépend que de map, pas de enabled

  // Gérer l'activation/désactivation séparément
  useEffect(() => {
    if (layerRef.current) {
      if (enabled) {
        layerRef.current.refresh();
      } else {
        layerRef.current.clearMarkers();
      }
    }
  }, [enabled]);

  return null; // Ce composant ne rend rien directement
};

export default AirportsLayer;