import { FEATURES } from '../flags';
import { NotImplementedProvider } from './providers/NotImplementedProvider';
import { SIADataProvider } from './providers/SIADataProvider';
import { SIACompleteProvider } from './providers/SIACompleteProvider';
import { GeoJSONProvider } from './providers/GeoJSONProvider';

let _aeroDataProvider = null;

function createAeroDataProvider() {
  // ✅ Utiliser le provider GeoJSON optimisé (10 MB, rapide, fonctionne sur Vercel)
  // Alternative: SIACompleteProvider (42 MB XML, lent, ne fonctionne pas sur Vercel)
  return new GeoJSONProvider();
}

export function getAeroDataProvider() {
  if (!_aeroDataProvider) {
    _aeroDataProvider = createAeroDataProvider();
  }
  return _aeroDataProvider;
}

export const aeroDataProvider = getAeroDataProvider();

export { AeroDataProvider } from './AeroDataProvider';