// src/abac/v2/types.js
//
// Format JSON v2 pour les abaques avec courbes de Bézier cubiques.
// Étend le format v1 (alflight/src/abac/curves/core/types.ts) sans le casser :
// - method 'bezier' ajoutée à InterpolationMethod
// - bezierSegments[] stocké dans `fitted` si method === 'bezier'
// - pdfReference au niveau du graph pour conserver le calque PDF d'origine
//
// Pas de TypeScript ici pour homogénéité avec le reste du projet JSX. Les
// "types" sont documentés en JSDoc pour l'autocomplétion.

/**
 * @typedef {Object} XYPoint
 * @property {number} x
 * @property {number} y
 * @property {string} [id]
 */

/**
 * @typedef {Object} BezierSegment
 * @property {XYPoint} p0  - Point de départ du segment
 * @property {XYPoint} cp1 - 1er control point (côté p0)
 * @property {XYPoint} cp2 - 2e control point (côté p1)
 * @property {XYPoint} p1  - Point d'arrivée
 */

/**
 * @typedef {Object} PixelPoint
 * @property {number} px - pixel x dans l'image affichée
 * @property {number} py - pixel y dans l'image affichée
 */

/**
 * @typedef {Object} Calibration
 * @property {PixelPoint} pixelOrigin - Pixel correspondant à (axes.xAxis.min, axes.yAxis.min)
 * @property {PixelPoint} pixelMax    - Pixel correspondant à (axes.xAxis.max, axes.yAxis.max)
 * @property {{xMin:number,xMax:number,yMin:number,yMax:number}} dataBounds
 */

/**
 * @typedef {Object} PdfReference
 * @property {string} imageDataUrl  - PNG/JPEG en data URL (calque background)
 * @property {number} imageWidth    - largeur native du PNG en pixels
 * @property {number} imageHeight   - hauteur native du PNG en pixels
 * @property {Calibration} calibration
 * @property {string} [sourceFile]  - nom du PDF d'origine
 * @property {number} [sourcePage]  - n° de page dans le PDF
 */

/**
 * @typedef {Object} CurveV2
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {XYPoint[]} points - points cliqués/saisis par l'utilisateur (data coords)
 * @property {Object} [fitted]
 * @property {'bezier'|'pchip'|'akima'|'naturalSpline'|'catmullRom'} fitted.method
 * @property {XYPoint[]} [fitted.points]
 * @property {BezierSegment[]} [fitted.bezierSegments]
 * @property {number} [fitted.rmse]
 */

/**
 * @typedef {Object} AbacGraphV2
 * @property {string} id
 * @property {string} name
 * @property {{xAxis:{min:number,max:number,unit:string,title:string}, yAxis:{min:number,max:number,unit:string,title:string}}} axes
 * @property {CurveV2[]} curves
 * @property {PdfReference} [pdfReference]
 */

/**
 * @typedef {Object} AbacJsonV2
 * @property {'2.0'} version
 * @property {AbacGraphV2[]} graphs
 * @property {Object} metadata
 * @property {string} metadata.createdAt
 * @property {string} metadata.updatedAt
 * @property {string} [metadata.modelName]
 */

export const ABAC_V2_VERSION = '2.0';
