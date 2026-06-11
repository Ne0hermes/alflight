// Core exports
export * from './core/types';
export * from './core/interpolation';
export * from './core/manager';
export * from './core/api';

// UI exports
// (R0 : AxesForm, PointEditor, GraphManager supprimés — orphelins, plus aucun montage.)
export { CurveManager } from './ui/CurveManager';
export { Chart } from './ui/Chart';
export { AbacBuilder } from './ui/AbacBuilder';

// Main exports for easy usage
export { abacCurvesAPI } from './core/api';
export { AbacCurveManager } from './core/manager';