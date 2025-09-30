import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const AirportsLayer = ({ enabled = true }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !enabled) return;
    
    return () => {
    };
  }, [map, enabled]);

  return null;
};

export default AirportsLayer;