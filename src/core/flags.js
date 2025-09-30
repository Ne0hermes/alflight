export const FEATURES = {
  OPENAIP_ENABLED: false,
  VAC_ENABLED: true,
  WEATHER_ENABLED: true,
  SHOW_DEV_PLACEHOLDERS: true,
  SHOW_DEBUG_INFO: false
};

export const isFeatureEnabled = (featureName) => {
  return FEATURES[featureName] === true;
};

export const OPENAIP_ENABLED = FEATURES.OPENAIP_ENABLED;