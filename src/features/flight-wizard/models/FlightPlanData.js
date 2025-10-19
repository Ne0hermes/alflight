/**
 * Modèle de données pour le plan de vol
 * Contient toutes les informations collectées pendant le wizard
 */
export class FlightPlanData {
  constructor() {
    // Étape 1 : Informations générales
    this.generalInfo = {
      callsign: '',           // Indicatif du vol
      flightType: 'VFR',      // Type de vol (VFR/IFR)
      dayNight: 'day',        // Période (day/night)
      flightNature: 'navigation', // Nature (local/navigation)
      date: new Date(),       // Date prévue du vol
    };

    // Étape 2 : Aéronef
    this.aircraft = {
      registration: '',       // Immatriculation
      type: '',              // Type d'aéronef
      model: '',             // Modèle
      cruiseSpeed: 0,        // Vitesse de croisière (kt)
      fuelConsumption: 0,    // Consommation (L/h)
      fuelCapacity: 0,       // Capacité carburant (L)
      emptyWeight: 0,        // Masse à vide (kg)
      maxWeight: 0,          // Masse max décollage (kg)
    };

    // Étape 3 : Trajet
    this.route = {
      departure: {
        icao: '',            // Code OACI départ
        name: '',            // Nom de l'aérodrome
        coordinates: null,    // {lat, lng}
        elevation: 0,        // Altitude terrain (ft)
      },
      arrival: {
        icao: '',            // Code OACI arrivée
        name: '',
        coordinates: null,
        elevation: 0,
      },
      waypoints: [],         // Points de cheminement [{name, coordinates}]
      distance: 0,           // Distance totale (NM)
      estimatedTime: 0,      // Temps estimé (minutes)
    };

    // Étape 4 : Aérodromes de déroutement
    this.alternates = [];     // [{icao, name, coordinates, distance}]

    // Étape 5 : Météo et NOTAMs
    this.weather = {
      departure: {
        metar: '',
        taf: '',
      },
      arrival: {
        metar: '',
        taf: '',
      },
      alternates: [],        // [{icao, metar, taf}]
      notamsChecked: false,  // Confirmation NOTAMs consultés
      weatherAcceptable: false, // Confirmation météo acceptable
    };

    // Étape 6 : Bilan carburant
    this.fuel = {
      taxi: 5,               // Carburant roulage (L)
      climb: 0,              // Carburant montée (L)
      cruise: 0,             // Carburant croisière (L)
      alternate: 0,          // Carburant déroutement (L)
      reserve: 0,            // Réserve réglementaire (L)
      contingency: 0,        // Contingence (L)
      total: 0,              // Total à embarquer (L)
      confirmed: 0,          // Valeur confirmée par pilote (L)
    };

    // Étape 7 : Masse et centrage
    this.weightBalance = {
      passengers: 1,         // Nombre de personnes
      passengersWeight: 80,  // Poids par personne (kg)
      baggage: 0,           // Poids bagages (kg)
      fuel: 0,              // Poids carburant (kg) - calculé
      takeoffWeight: 0,     // Masse décollage (kg)
      landingWeight: 0,     // Masse atterrissage (kg)
      cg: {                 // Centre de gravité
        takeoff: 0,
        landing: 0,
      },
      withinLimits: true,   // Dans les limites ?
    };

    // Étape 8 : Paramètres TOD (Top of Descent)
    this.todParameters = {
      cruiseAltitude: 3000,      // Altitude de croisière (ft)
      descentRate: 500,          // Taux de descente (ft/min)
      patternAltitude: 1500,     // Altitude pattern au-dessus du terrain (ft)
      arrivalElevation: 0,       // Altitude terrain arrivée (ft)
      groundSpeed: 120,          // Vitesse sol (kt)
      // Résultats calculés
      distanceToTod: 0,          // Distance au TOD (NM)
      descentTime: 0,            // Temps de descente (min)
      descentAngle: 0,           // Angle de descente (°)
      altitudeToDescent: 0,      // Altitude à descendre (ft)
    };

    // Métadonnées
    this.metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0',
      status: 'draft',      // draft, completed, filed
    };
  }

  /**
   * Met à jour les informations générales
   */
  updateGeneralInfo(data) {
    this.generalInfo = { ...this.generalInfo, ...data };
    this.updateTimestamp();
  }

  /**
   * Met à jour les informations de l'aéronef
   */
  updateAircraft(data) {
    this.aircraft = { ...this.aircraft, ...data };
    this.updateTimestamp();
  }

  /**
   * Met à jour le trajet
   */
  updateRoute(data) {
    this.route = { ...this.route, ...data };
    this.calculateRouteDistance();
    this.updateTimestamp();
  }

  /**
   * Ajoute un aérodrome de déroutement
   */
  addAlternate(alternate) {
    this.alternates.push(alternate);
    this.updateTimestamp();
  }

  /**
   * Supprime un aérodrome de déroutement
   */
  removeAlternate(icao) {
    this.alternates = this.alternates.filter(alt => alt.icao !== icao);
    this.updateTimestamp();
  }

  /**
   * Met à jour les informations météo
   */
  updateWeather(data) {
    this.weather = { ...this.weather, ...data };
    this.updateTimestamp();
  }

  /**
   * Calcule et met à jour le bilan carburant
   */
  calculateFuel() {
    const { distance } = this.route;
    const { cruiseSpeed, fuelConsumption } = this.aircraft;
    
    if (distance && cruiseSpeed && fuelConsumption) {
      // Temps de vol en heures
      const flightTime = distance / cruiseSpeed;
      
      // Carburant croisière
      this.fuel.cruise = Math.ceil(flightTime * fuelConsumption);
      
      // Carburant montée (estimation : 10% du trajet)
      this.fuel.climb = Math.ceil(this.fuel.cruise * 0.1);
      
      // Carburant déroutement (plus long déroutement + 10%)
      if (this.alternates.length > 0) {
        const maxAlternateDistance = Math.max(...this.alternates.map(alt => alt.distance));
        const alternateTime = maxAlternateDistance / cruiseSpeed;
        this.fuel.alternate = Math.ceil(alternateTime * fuelConsumption * 1.1);
      }
      
      // Réserve réglementaire (30 min VFR, 45 min IFR)
      const reserveTime = this.generalInfo.flightType === 'VFR' ? 0.5 : 0.75;
      this.fuel.reserve = Math.ceil(reserveTime * fuelConsumption);
      
      // Contingence (5% du trajet)
      this.fuel.contingency = Math.ceil(this.fuel.cruise * 0.05);
      
      // Total
      this.fuel.total = this.fuel.taxi + this.fuel.climb + this.fuel.cruise + 
                       this.fuel.alternate + this.fuel.reserve + this.fuel.contingency;
      
      // Par défaut, confirmé = total
      this.fuel.confirmed = this.fuel.total;
    }
    
    this.updateTimestamp();
    return this.fuel;
  }

  /**
   * Met à jour le carburant confirmé
   */
  confirmFuel(amount) {
    this.fuel.confirmed = amount;
    this.updateTimestamp();
  }

  /**
   * Calcule la masse et centrage
   */
  calculateWeightBalance() {
    const { emptyWeight } = this.aircraft;
    const { passengers, passengersWeight, baggage } = this.weightBalance;
    const { confirmed: fuelLiters } = this.fuel;
    
    // Conversion carburant L -> kg (densité moyenne 0.72 kg/L)
    const fuelWeight = fuelLiters * 0.72;
    this.weightBalance.fuel = fuelWeight;
    
    // Masse au décollage
    this.weightBalance.takeoffWeight = emptyWeight + 
                                       (passengers * passengersWeight) + 
                                       baggage + 
                                       fuelWeight;
    
    // Masse à l'atterrissage (sans le carburant consommé)
    const consumedFuel = (this.fuel.climb + this.fuel.cruise) * 0.72;
    this.weightBalance.landingWeight = this.weightBalance.takeoffWeight - consumedFuel;
    
    // Vérification des limites
    this.weightBalance.withinLimits = this.weightBalance.takeoffWeight <= this.aircraft.maxWeight;
    
    this.updateTimestamp();
    return this.weightBalance;
  }

  /**
   * Met à jour la masse et centrage
   */
  updateWeightBalance(data) {
    this.weightBalance = { ...this.weightBalance, ...data };
    this.calculateWeightBalance();
  }

  /**
   * Calcule les paramètres TOD (Top of Descent)
   */
  calculateTOD() {
    const { cruiseAltitude, descentRate, patternAltitude, arrivalElevation, groundSpeed } = this.todParameters;

    // Altitude pattern réelle = terrain + offset pattern
    const targetAltitude = arrivalElevation + patternAltitude;

    // Altitude à descendre
    const altitudeToDescent = cruiseAltitude - targetAltitude;

    if (altitudeToDescent <= 0) {
      // Pas de descente nécessaire ou montée requise
      this.todParameters.altitudeToDescent = altitudeToDescent;
      this.todParameters.distanceToTod = 0;
      this.todParameters.descentTime = 0;
      this.todParameters.descentAngle = 0;
      return this.todParameters;
    }

    // Temps de descente (minutes)
    const descentTime = altitudeToDescent / descentRate;

    // Vitesse sol en NM/min
    const groundSpeedNmPerMin = groundSpeed / 60;

    // Distance au TOD (NM)
    const distanceToTod = descentTime * groundSpeedNmPerMin;

    // Angle de descente (degrés)
    const descentAngle = Math.atan((altitudeToDescent / 6076.12) / distanceToTod) * 180 / Math.PI;

    // Mise à jour des résultats
    this.todParameters.altitudeToDescent = altitudeToDescent;
    this.todParameters.distanceToTod = parseFloat(distanceToTod.toFixed(1));
    this.todParameters.descentTime = Math.round(descentTime);
    this.todParameters.descentAngle = parseFloat(descentAngle.toFixed(1));

    this.updateTimestamp();
    return this.todParameters;
  }

  /**
   * Met à jour les paramètres TOD
   */
  updateTODParameters(data) {
    this.todParameters = { ...this.todParameters, ...data };
    this.calculateTOD();
  }

  /**
   * Calcule la distance du trajet
   */
  calculateRouteDistance() {
    // Calcul simplifié - en production, utiliser une formule de grande cercle
    if (this.route.departure.coordinates && this.route.arrival.coordinates) {
      const R = 3440.065; // Rayon de la Terre en NM
      const lat1 = this.route.departure.coordinates.lat * Math.PI / 180;
      const lat2 = this.route.arrival.coordinates.lat * Math.PI / 180;
      const deltaLat = (this.route.arrival.coordinates.lat - this.route.departure.coordinates.lat) * Math.PI / 180;
      const deltaLng = (this.route.arrival.coordinates.lng - this.route.departure.coordinates.lng) * Math.PI / 180;
      
      const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      this.route.distance = Math.round(R * c);
      
      // Temps estimé
      if (this.aircraft.cruiseSpeed) {
        this.route.estimatedTime = Math.round((this.route.distance / this.aircraft.cruiseSpeed) * 60);
      }
    }
  }

  /**
   * Met à jour le timestamp
   */
  updateTimestamp() {
    this.metadata.updatedAt = new Date();
  }

  /**
   * Valide que toutes les étapes sont complètes
   */
  isComplete() {
    return (
      this.generalInfo.callsign &&
      this.aircraft.registration &&
      this.route.departure.icao &&
      this.route.arrival.icao &&
      this.alternates.length > 0 &&
      this.weather.notamsChecked &&
      this.weather.weatherAcceptable &&
      this.fuel.confirmed > 0 &&
      this.weightBalance.passengers > 0 &&
      this.weightBalance.withinLimits
    );
  }

  /**
   * Génère un résumé du plan de vol
   */
  generateSummary() {
    return {
      callsign: this.generalInfo.callsign,
      date: this.generalInfo.date,
      aircraft: `${this.aircraft.type} (${this.aircraft.registration})`,
      route: `${this.route.departure.icao} → ${this.route.arrival.icao}`,
      distance: `${this.route.distance} NM`,
      time: `${Math.floor(this.route.estimatedTime / 60)}h${this.route.estimatedTime % 60}min`,
      fuel: `${this.fuel.confirmed} L`,
      takeoffWeight: `${this.weightBalance.takeoffWeight} kg`,
      passengers: this.weightBalance.passengers,
      alternates: this.alternates.map(alt => alt.icao).join(', '),
    };
  }

  /**
   * Export vers JSON
   */
  toJSON() {
    return JSON.stringify(this, null, 2);
  }

  /**
   * Import depuis JSON
   */
  static fromJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const flightPlan = new FlightPlanData();
    Object.assign(flightPlan, data);
    return flightPlan;
  }
}

export default FlightPlanData;