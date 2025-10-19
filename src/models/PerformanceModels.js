// src/models/PerformanceModels.js

/**
 * Modèles de données pour les performances aéronautiques
 * Organise les abaques par type d'opération
 */

export class AircraftPerformanceModel {
  constructor() {
    this.metadata = {
      aircraftType: '',
      registration: '',
      manufacturer: '',
      model: '',
      lastUpdated: new Date().toISOString(),
      dataSource: 'manual' // 'manual', 'digitized', 'api'
    };

    // Séparation des abaques par catégorie
    this.takeoffCharts = new TakeoffPerformanceCharts();
    this.landingCharts = new LandingPerformanceCharts();
    this.climbCharts = new ClimbPerformanceCharts();
    this.cruiseCharts = new CruisePerformanceCharts();
    this.fuelCharts = new FuelPerformanceCharts();
    this.weightBalanceCharts = new WeightBalanceCharts();
  }

  /**
   * Ajoute un abaque au modèle dans la catégorie appropriée
   */
  addChart(chartData, category) {
    const timestamp = new Date().toISOString();
    
    switch(category) {
      case 'takeoff':
        this.takeoffCharts.addChart(chartData);
        break;
      case 'landing':
        this.landingCharts.addChart(chartData);
        break;
      case 'climb':
        this.climbCharts.addChart(chartData);
        break;
      case 'cruise':
        this.cruiseCharts.addChart(chartData);
        break;
      case 'fuel':
        this.fuelCharts.addChart(chartData);
        break;
      case 'weight':
        this.weightBalanceCharts.addChart(chartData);
        break;
      default:
        
    }
    
    this.metadata.lastUpdated = timestamp;
  }

  /**
   * Récupère tous les abaques d'une catégorie
   */
  getChartsByCategory(category) {
    switch(category) {
      case 'takeoff':
        return this.takeoffCharts.getAllCharts();
      case 'landing':
        return this.landingCharts.getAllCharts();
      case 'climb':
        return this.climbCharts.getAllCharts();
      case 'cruise':
        return this.cruiseCharts.getAllCharts();
      case 'fuel':
        return this.fuelCharts.getAllCharts();
      case 'weight':
        return this.weightBalanceCharts.getAllCharts();
      default:
        return [];
    }
  }

  /**
   * Exporte le modèle complet en JSON
   */
  toJSON() {
    return {
      metadata: this.metadata,
      takeoff: this.takeoffCharts.toJSON(),
      landing: this.landingCharts.toJSON(),
      climb: this.climbCharts.toJSON(),
      cruise: this.cruiseCharts.toJSON(),
      fuel: this.fuelCharts.toJSON(),
      weightBalance: this.weightBalanceCharts.toJSON()
    };
  }

  /**
   * Charge un modèle depuis JSON
   */
  static fromJSON(json) {
    const model = new AircraftPerformanceModel();
    
    if (json.metadata) {
      model.metadata = json.metadata;
    }
    
    if (json.takeoff) {
      model.takeoffCharts = TakeoffPerformanceCharts.fromJSON(json.takeoff);
    }
    
    if (json.landing) {
      model.landingCharts = LandingPerformanceCharts.fromJSON(json.landing);
    }
    
    if (json.climb) {
      model.climbCharts = ClimbPerformanceCharts.fromJSON(json.climb);
    }
    
    if (json.cruise) {
      model.cruiseCharts = CruisePerformanceCharts.fromJSON(json.cruise);
    }
    
    if (json.fuel) {
      model.fuelCharts = FuelPerformanceCharts.fromJSON(json.fuel);
    }
    
    if (json.weightBalance) {
      model.weightBalanceCharts = WeightBalanceCharts.fromJSON(json.weightBalance);
    }
    
    return model;
  }
}

/**
 * Classe de base pour une catégorie d'abaques
 */
class PerformanceChartCategory {
  constructor(categoryName) {
    this.categoryName = categoryName;
    this.charts = [];
    this.defaultChart = null;
  }

  addChart(chartData) {
    const chart = {
      id: this.generateId(),
      name: chartData.name || `${this.categoryName}_${this.charts.length + 1}`,
      conditions: chartData.conditions || {},
      axes: chartData.axes || {},
      dataPoints: chartData.dataPoints || [],
      interpolationMethod: chartData.interpolationMethod || 'linear',
      confidence: chartData.confidence || 0.95,
      source: chartData.source || 'manual',
      dateAdded: new Date().toISOString(),
      isDefault: chartData.isDefault || false
    };

    this.charts.push(chart);

    if (chart.isDefault || !this.defaultChart) {
      this.defaultChart = chart.id;
    }

    return chart.id;
  }

  getAllCharts() {
    return this.charts;
  }

  getChart(id) {
    return this.charts.find(chart => chart.id === id);
  }

  getDefaultChart() {
    return this.charts.find(chart => chart.id === this.defaultChart);
  }

  setDefaultChart(id) {
    const chart = this.getChart(id);
    if (chart) {
      this.defaultChart = id;
      return true;
    }
    return false;
  }

  removeChart(id) {
    const index = this.charts.findIndex(chart => chart.id === id);
    if (index !== -1) {
      this.charts.splice(index, 1);
      if (this.defaultChart === id) {
        this.defaultChart = this.charts.length > 0 ? this.charts[0].id : null;
      }
      return true;
    }
    return false;
  }

  generateId() {
    return `${this.categoryName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      categoryName: this.categoryName,
      charts: this.charts,
      defaultChart: this.defaultChart
    };
  }

  static fromJSON(json, CategoryClass) {
    const category = new CategoryClass();
    category.charts = json.charts || [];
    category.defaultChart = json.defaultChart || null;
    return category;
  }
}

/**
 * Abaques de décollage
 */
class TakeoffPerformanceCharts extends PerformanceChartCategory {
  constructor() {
    super('takeoff');
    this.specificParameters = {
      flapSettings: ['0°', '10°', '20°', '30°'],
      runwayConditions: ['dry', 'wet', 'contaminated'],
      obstacles: ['clear', '50ft', '35ft']
    };
  }

  /**
   * Calcule la distance de décollage pour des conditions données
   */
  calculateTakeoffDistance(conditions, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque de décollage disponible');
    }

    return this.interpolate(chart, conditions);
  }

  /**
   * Interpolation spécifique au décollage
   */
  interpolate(chart, conditions) {
    // Logique d'interpolation pour les abaques de décollage
    const { temperature, pressureAltitude, mass, wind, flaps } = conditions;
    
    // Trouver les points les plus proches
    const nearestPoints = this.findNearestPoints(chart.dataPoints, conditions);
    
    // Interpolation IDW (Inverse Distance Weighting)
    return this.idwInterpolation(nearestPoints, conditions);
  }

  findNearestPoints(dataPoints, conditions, count = 4) {
    const distances = dataPoints.map(point => ({
      point,
      distance: this.calculateDistance(point, conditions)
    }));

    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, count);
  }

  calculateDistance(point, conditions) {
    const weights = {
      temperature: 1.0 / 30,  // Normalisation sur 30°C
      pressureAltitude: 1.0 / 2000,  // Normalisation sur 2000ft
      mass: 1.0 / 100,  // Normalisation sur 100kg
      wind: 1.0 / 10   // Normalisation sur 10kt
    };

    let distance = 0;
    distance += Math.pow((point.temperature - conditions.temperature) * weights.temperature, 2);
    distance += Math.pow((point.pressureAltitude - conditions.pressureAltitude) * weights.pressureAltitude, 2);
    distance += Math.pow((point.mass - conditions.mass) * weights.mass, 2);
    distance += Math.pow((point.wind - conditions.wind) * weights.wind, 2);

    return Math.sqrt(distance);
  }

  idwInterpolation(nearestPoints, conditions) {
    let totalWeight = 0;
    let weightedSum = {
      groundRoll: 0,
      distance50ft: 0
    };

    nearestPoints.forEach(({ point, distance }) => {
      const weight = 1 / (distance + 0.001); // Éviter division par zéro
      totalWeight += weight;
      
      weightedSum.groundRoll += (point.groundRoll || 0) * weight;
      weightedSum.distance50ft += (point.distance50ft || 0) * weight;
    });

    return {
      groundRoll: Math.round(weightedSum.groundRoll / totalWeight),
      distance50ft: Math.round(weightedSum.distance50ft / totalWeight),
      confidence: this.calculateConfidence(nearestPoints),
      method: 'IDW',
      usedPoints: nearestPoints.length
    };
  }

  calculateConfidence(nearestPoints) {
    if (nearestPoints.length === 0) return 0;
    
    const avgDistance = nearestPoints.reduce((sum, p) => sum + p.distance, 0) / nearestPoints.length;
    // Confiance basée sur la distance moyenne (plus proche = plus confiant)
    return Math.max(0, Math.min(1, 1 - avgDistance));
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, TakeoffPerformanceCharts);
  }
}

/**
 * Abaques d'atterrissage
 */
class LandingPerformanceCharts extends PerformanceChartCategory {
  constructor() {
    super('landing');
    this.specificParameters = {
      flapSettings: ['0°', '20°', '30°', 'FULL'],
      runwayConditions: ['dry', 'wet', 'contaminated'],
      approach: ['normal', 'steep', 'short']
    };
  }

  calculateLandingDistance(conditions, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque d\'atterrissage disponible');
    }

    // Similaire à takeoff mais avec des paramètres spécifiques landing
    return this.interpolate(chart, conditions);
  }

  interpolate(chart, conditions) {
    // Réutiliser la logique de TakeoffPerformanceCharts
    // mais avec des ajustements pour l'atterrissage
    const takeoffCharts = new TakeoffPerformanceCharts();
    const result = takeoffCharts.interpolate(chart, conditions);
    
    // Renommer les champs pour l'atterrissage
    return {
      groundRoll: result.groundRoll,
      totalDistance: result.distance50ft,
      confidence: result.confidence,
      method: result.method,
      usedPoints: result.usedPoints
    };
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, LandingPerformanceCharts);
  }
}

/**
 * Abaques de montée
 */
class ClimbPerformanceCharts extends PerformanceChartCategory {
  constructor() {
    super('climb');
    this.specificParameters = {
      climbTypes: ['normal', 'best_rate', 'best_angle', 'cruise_climb'],
      powerSettings: ['MTKF', '75%', '65%', '55%']
    };
  }

  calculateClimbPerformance(conditions, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque de montée disponible');
    }

    return {
      rateOfClimb: this.interpolateRate(chart, conditions),
      timeToAltitude: this.calculateTimeToAltitude(chart, conditions),
      fuelUsed: this.calculateFuelUsed(chart, conditions)
    };
  }

  interpolateRate(chart, conditions) {
    // Logique spécifique pour le taux de montée
    return 500; // ft/min - placeholder
  }

  calculateTimeToAltitude(chart, conditions) {
    // Calcul du temps pour atteindre une altitude
    return 10; // minutes - placeholder
  }

  calculateFuelUsed(chart, conditions) {
    // Calcul du carburant utilisé en montée
    return 5; // litres - placeholder
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, ClimbPerformanceCharts);
  }
}

/**
 * Abaques de croisière
 */
class CruisePerformanceCharts extends PerformanceChartCategory {
  constructor() {
    super('cruise');
    this.specificParameters = {
      powerSettings: ['75%', '65%', '55%', '45%'],
      altitudes: [2000, 4000, 6000, 8000, 10000, 12000],
      leaningModes: ['best_power', 'best_economy']
    };
  }

  calculateCruisePerformance(conditions, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque de croisière disponible');
    }

    return {
      trueAirspeed: this.calculateTAS(chart, conditions),
      fuelFlow: this.calculateFuelFlow(chart, conditions),
      range: this.calculateRange(chart, conditions),
      endurance: this.calculateEndurance(chart, conditions)
    };
  }

  calculateTAS(chart, conditions) {
    // Calcul de la vitesse vraie
    return 120; // knots - placeholder
  }

  calculateFuelFlow(chart, conditions) {
    // Calcul de la consommation
    return 25; // L/h - placeholder
  }

  calculateRange(chart, conditions) {
    // Calcul de la distance franchissable
    return 500; // nm - placeholder
  }

  calculateEndurance(chart, conditions) {
    // Calcul de l'autonomie
    return 4; // hours - placeholder
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, CruisePerformanceCharts);
  }
}

/**
 * Abaques de carburant
 */
class FuelPerformanceCharts extends PerformanceChartCategory {
  constructor() {
    super('fuel');
    this.specificParameters = {
      phases: ['taxi', 'takeoff', 'climb', 'cruise', 'descent', 'approach'],
      reserves: ['VFR', 'IFR', 'alternate']
    };
  }

  calculateFuelRequired(flightProfile, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque de carburant disponible');
    }

    return {
      taxi: this.calculateTaxiFuel(chart, flightProfile),
      trip: this.calculateTripFuel(chart, flightProfile),
      reserve: this.calculateReserveFuel(chart, flightProfile),
      alternate: this.calculateAlternateFuel(chart, flightProfile),
      total: 0 // Sera calculé comme somme
    };
  }

  calculateTaxiFuel(chart, profile) {
    return 2; // litres - placeholder
  }

  calculateTripFuel(chart, profile) {
    return 50; // litres - placeholder
  }

  calculateReserveFuel(chart, profile) {
    return 15; // litres - placeholder
  }

  calculateAlternateFuel(chart, profile) {
    return 20; // litres - placeholder
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, FuelPerformanceCharts);
  }
}

/**
 * Abaques de masse et centrage
 */
class WeightBalanceCharts extends PerformanceChartCategory {
  constructor() {
    super('weight_balance');
    this.specificParameters = {
      stations: ['pilot', 'copilot', 'rear_pax', 'baggage', 'fuel'],
      limits: ['forward_cg', 'aft_cg', 'max_weight']
    };
  }

  calculateWeightBalance(loadingData, chartId = null) {
    const chart = chartId ? this.getChart(chartId) : this.getDefaultChart();
    if (!chart) {
      throw new Error('Aucun abaque de masse et centrage disponible');
    }

    return {
      totalWeight: this.calculateTotalWeight(loadingData),
      centerOfGravity: this.calculateCG(loadingData),
      withinLimits: this.checkLimits(loadingData, chart),
      moment: this.calculateMoment(loadingData)
    };
  }

  calculateTotalWeight(loadingData) {
    return Object.values(loadingData).reduce((sum, item) => sum + (item.weight || 0), 0);
  }

  calculateCG(loadingData) {
    const totalMoment = Object.values(loadingData).reduce((sum, item) => {
      return sum + (item.weight || 0) * (item.arm || 0);
    }, 0);
    
    const totalWeight = this.calculateTotalWeight(loadingData);
    return totalWeight > 0 ? totalMoment / totalWeight : 0;
  }

  calculateMoment(loadingData) {
    return Object.values(loadingData).reduce((sum, item) => {
      return sum + (item.weight || 0) * (item.arm || 0);
    }, 0);
  }

  checkLimits(loadingData, chart) {
    const cg = this.calculateCG(loadingData);
    const weight = this.calculateTotalWeight(loadingData);
    
    // Vérifier contre les limites du chart
    return {
      cgInLimits: true, // placeholder
      weightInLimits: true // placeholder
    };
  }

  static fromJSON(json) {
    return PerformanceChartCategory.fromJSON(json, WeightBalanceCharts);
  }
);}

// Export des classes
export {
  PerformanceChartCategory,
  TakeoffPerformanceCharts,
  LandingPerformanceCharts,
  ClimbPerformanceCharts,
  CruisePerformanceCharts,
  FuelPerformanceCharts,
  WeightBalanceCharts
};

// Export par défaut
export default AircraftPerformanceModel;