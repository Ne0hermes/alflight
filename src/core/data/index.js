import { FEATURES } from '../flags';
import { NotImplementedProvider } from './providers/NotImplementedProvider';
import { SIADataProvider } from './providers/SIADataProvider';
import { SIACompleteProvider } from './providers/SIACompleteProvider';

let _aeroDataProvider = null;

function createAeroDataProvider() {
  // Utiliser le provider SIA complet avec toutes les données AIXM
  // Pour revenir au provider simple, remplacer par : return new SIADataProvider();
  return new SIACompleteProvider();
}

export function getAeroDataProvider() {
  if (!_aeroDataProvider) {
    _aeroDataProvider = createAeroDataProvider();
  }
  return _aeroDataProvider;
}

export const aeroDataProvider = getAeroDataProvider();

export { AeroDataProvider } from './AeroDataProvider';