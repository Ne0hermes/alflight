export const Conversions = {
  kphToKt: (kph) => kph / 1.852,
  ktToKph: (kt) => kt * 1.852,
  litersToGallons: (liters) => liters / 3.78541,
  gallonsToLiters: (gallons) => gallons * 3.78541,
  
  // Conversion coordonnées décimales vers DMS (Degrés Minutes Secondes)
  decimalToDMS: (decimal, isLat) => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    
    const direction = decimal >= 0 
      ? (isLat ? 'N' : 'E') 
      : (isLat ? 'S' : 'W');
    
    return `${String(degrees).padStart(2, '0')}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"${direction}`;
  },
  
  // Conversion d'une paire de coordonnées
  coordinatesToDMS: (lat, lon) => {
    return {
      lat: Conversions.decimalToDMS(lat, true),
      lon: Conversions.decimalToDMS(lon, false),
      formatted: `${Conversions.decimalToDMS(lat, true)} - ${Conversions.decimalToDMS(lon, false)}`
    };
  }
};