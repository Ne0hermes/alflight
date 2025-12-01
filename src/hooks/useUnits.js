// src/hooks/useUnits.js
import { useEffect, useState } from 'react';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, formatWithUnit } from '@utils/unitConversions';

/**
 * Hook personnalisé pour gérer les unités et conversions
 */
export const useUnits = () => {
  const [units, setUnitsState] = useState(unitsSelectors.useUnits());
  const { setUnit, setPreset } = unitsSelectors.useUnitsActions();

  // Écouter les changements d'unités via l'événement custom
  useEffect(() => {
    const handleUnitsUpdate = (event) => {
      // Forcer la mise à jour depuis le store
      const newUnits = useUnitsStore.getState().units;
      setUnitsState(newUnits);
    };

    window.addEventListener('unitsUpdated', handleUnitsUpdate);

    // Également s'abonner aux changements du store directement
    const unsubscribe = useUnitsStore.subscribe((state) => {
      setUnitsState(state.units);
    });

    return () => {
      window.removeEventListener('unitsUpdated', handleUnitsUpdate);
      unsubscribe();
    };
  }, []);

  /**
   * Convertit une valeur depuis l'unité de stockage vers l'unité préférée de l'utilisateur
   * @param {number} value - La valeur à convertir
   * @param {string} category - La catégorie d'unité (distance, altitude, etc.)
   * @param {string} fromUnit - L'unité source (par défaut: unité standard de stockage)
   * @param {Object} options - Options supplémentaires (ex: fuelType, toUnit)
   * @returns {number} La valeur convertie
   */
  const convert = (value, category, fromUnit = null, options = {}) => {
    if (value === null || value === undefined || isNaN(value)) return value;

    // Unités standard de stockage (format interne)
    const storageUnits = {
      distance: 'nm',
      altitude: 'ft',
      runway: 'm',
      visibility: 'km',
      speed: 'kt',
      windSpeed: 'kt',
      weight: 'kg',
      fuel: 'ltr',
      pressure: 'hPa',
      temperature: 'C',
      fuelConsumption: 'lph'
    };

    const from = fromUnit || storageUnits[category];
    const to = options.toUnit || units[category];

    const shouldSkip = !from || !to || from === to;

    console.log('🔧 [useUnits.convert]', {
      value,
      category,
      from,
      to,
      fromType: typeof from,
      toType: typeof to,
      fromTrimmed: String(from).trim(),
      toTrimmed: String(to).trim(),
      areEqual: from === to,
      shouldSkip,
      unitsState: units
    });

    if (shouldSkip) {
      console.warn('⚠️ [useUnits.convert] SKIPPING conversion:', { from, to, shouldSkip });
      return value;
    }

    const converted = convertValue(value, from, to, category, options);
    console.log('✅ [useUnits.convert] Result:', converted);
    return converted;
  };

  /**
   * Formate une valeur avec son unité préférée
   * @param {number} value - La valeur à formater
   * @param {string} category - La catégorie d'unité
   * @param {number} decimals - Nombre de décimales
   * @param {string} fromUnit - L'unité source (optionnel)
   * @returns {string} La valeur formatée avec l'unité
   */
  const format = (value, category, decimals = 1, fromUnit = null) => {
    const convertedValue = convert(value, category, fromUnit);
    return formatWithUnit(convertedValue, units[category], decimals);
  };

  /**
   * Convertit une valeur de l'unité utilisateur vers l'unité de stockage
   * @param {number} value - La valeur saisie par l'utilisateur
   * @param {string} category - La catégorie d'unité
   * @returns {number} La valeur en unité de stockage
   */
  const toStorage = (value, category) => {
    if (value === null || value === undefined || isNaN(value)) return value;

    const storageUnits = {
      distance: 'nm',
      altitude: 'ft',
      runway: 'm',
      visibility: 'km',
      speed: 'kt',
      windSpeed: 'kt',
      weight: 'kg',
      fuel: 'ltr',
      pressure: 'hPa',
      temperature: 'C',
      fuelConsumption: 'lph'
    };

    const from = units[category];
    const to = storageUnits[category];

    if (!from || !to || from === to) return value;

    return convertValue(value, from, to, category);
  };

  /**
   * Obtient l'unité actuelle pour une catégorie
   * @param {string} category - La catégorie d'unité
   * @returns {string} L'unité actuelle
   */
  const getUnit = (category) => {
    return units[category];
  };

  /**
   * Obtient le symbole d'unité pour affichage
   * @param {string} category - La catégorie d'unité
   * @returns {string} Le symbole d'unité
   */
  const getSymbol = (category) => {
    const symbols = {
      // Distance
      'nm': 'NM',
      'km': 'km',
      'mi': 'mi',
      'm': 'm',

      // Altitude
      'ft': 'ft',
      'FL': 'FL',

      // Vitesse
      'kt': 'kt',
      'km/h': 'km/h',
      'mph': 'mph',
      'm/s': 'm/s',

      // Poids
      'kg': 'kg',
      'lbs': 'lbs',

      // Carburant
      'ltr': 'L',
      'gal': 'gal',

      // Pression
      'hPa': 'hPa',
      'inHg': 'inHg',
      'mb': 'mb',

      // Température
      'C': '°C',
      'F': '°F',

      // Consommation
      'lph': 'L/h',
      'gph': 'gal/h'
    };

    const unit = units[category];
    return symbols[unit] || unit;
  };

  return {
    units,
    convert,
    format,
    toStorage,
    getUnit,
    getSymbol,
    setUnit,
    setPreset
  };
};