import { GeoJSONProvider } from './providers/GeoJSONProvider';

let _aeroDataProvider = null;

function createAeroDataProvider() {
  // ✅ Provider unique : GeoJSON dérivé du SIA (rapide, Vercel-friendly).
  // Les providers alternatifs inutilisés (SIACompleteProvider/XML 42 Mo, SIADataProvider,
  // NotImplementedProvider) ont été supprimés — le GeoJSON est la source unique.
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