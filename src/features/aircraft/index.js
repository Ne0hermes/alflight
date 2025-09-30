// src/features/aircraft/index.js
console.log('Loading aircraft/index.js...');

import AircraftModule from './AircraftModule';
import AircraftCreationWizard from './components/AircraftCreationWizard';

console.log('Imported components:', {
  AircraftModule: !!AircraftModule,
  AircraftCreationWizard: !!AircraftCreationWizard
});

export default AircraftModule;
export { AircraftCreationWizard };

console.log('Exports configured successfully');