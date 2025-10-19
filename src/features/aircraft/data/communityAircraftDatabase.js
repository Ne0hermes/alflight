// Base de données centralisée des avions communautaires
// ATTENTION: Ce fichier est OBSOLÈTE et ne doit PLUS être utilisé
// Les données sont maintenant chargées depuis Supabase via communityService.js
// Ce fichier est conservé uniquement pour la compatibilité temporaire


// Base de données vide - toutes les données sont maintenant dans Supabase
export const COMMUNITY_AIRCRAFT_DATABASE = [];

// Fonctions utilitaires - NE PLUS UTILISER
// Ces fonctions retournent toujours null/false
export const getAircraftByRegistration = (registration) => {
  console.error('❌ getAircraftByRegistration est obsolète. Utilisez communityService.getAllPresets() à la place.');
  return null;
};

export const aircraftExists = (registration) => {
  console.error('❌ aircraftExists est obsolète. Utilisez communityService.getAllPresets() à la place.');
  return false;
};
