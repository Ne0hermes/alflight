import { GeoJSONProvider } from './providers/GeoJSONProvider';

let _aeroDataProvider = null;

function createAeroDataProvider() {
  // ✅ Utiliser le provider GeoJSON optimisé (10 MB, rapide, fonctionne sur Vercel)
  // Note: SIACompleteProvider (42 MB XML) n'est plus importé car il charge les XML au moment de l'import
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