import React from 'react';
import { Calculator, Plane, TrendingUp, TrendingDown, Mountain, Thermometer, Wind, CheckCircle, AlertTriangle } from 'lucide-react';

const PerformanceModuleDemo = () => {
  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-50">
      {/* Header du module */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Calculator size={24} />
          Performances de décollage et d'atterrissage
        </h2>
        
        {/* Info avion */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold">F-GKXS</h4>
              <p className="text-gray-600">Cessna 172S</p>
            </div>
            <div className="text-right text-sm">
              <p>MTOW: <strong>1111 kg</strong></p>
              <p>Vitesse croisière: <strong>122 kt</strong></p>
            </div>
          </div>
          
          <div className="bg-white rounded p-3">
            <h5 className="text-sm font-bold mb-2">Performances standard (ISA, niveau mer)</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p>• TOD: <strong>290 m</strong></p>
              <p>• ASD: <strong>520 m</strong></p>
              <p>• LD: <strong>215 m</strong></p>
              <p>• LD UP: <strong>395 m</strong></p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Départ */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-green-500">
        <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
          <TrendingUp size={20} className="text-green-600" />
          Décollage - LFPN
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">VAC</span>
        </h4>
        
        {/* Conditions */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mountain size={16} />
              <span>Altitude</span>
            </div>
            <p className="font-bold">538 ft</p>
            <p className="text-xs text-gray-500">VAC</p>
          </div>
          
          <div className="bg-green-50 rounded p-3 border border-green-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Thermometer size={16} />
              <span>Température</span>
            </div>
            <p className="font-bold">22°C</p>
            <p className="text-xs text-gray-500">ISA +8°</p>
          </div>
          
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Wind size={16} />
              <span>Facteur</span>
            </div>
            <p className="font-bold">×1.13</p>
          </div>
        </div>
        
        {/* Météo */}
        <div className="bg-gray-50 rounded p-3 mb-4">
          <p className="text-sm font-bold mb-2">🌤️ Conditions météo actuelles</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>• Vent : 270° / 8kt</p>
            <p>• Visibilité : 10km</p>
            <p>• QNH : 1018 hPa</p>
            <p>• Point de rosée : 15°C</p>
          </div>
        </div>
        
        {/* Distances corrigées */}
        <div className="mb-4">
          <h5 className="text-sm font-bold text-gray-600 mb-2">Distances corrigées</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded p-3">
              <p className="text-xs text-gray-600">TOD (Take-off Distance)</p>
              <p className="text-xl font-bold">328 m</p>
              <p className="text-xs text-gray-500">(290 m std)</p>
            </div>
            <div className="bg-gray-100 rounded p-3">
              <p className="text-xs text-gray-600">ASD (Accelerate-Stop)</p>
              <p className="text-xl font-bold">588 m</p>
              <p className="text-xs text-gray-500">(520 m std)</p>
            </div>
          </div>
        </div>
        
        {/* Analyse pistes */}
        <div>
          <h5 className="text-sm font-bold text-gray-600 mb-2">Analyse des pistes disponibles</h5>
          <div className="space-y-2">
            <div className="bg-green-50 border border-green-300 rounded p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-green-700 flex items-center gap-2">
                    <CheckCircle size={16} />
                    Piste 07/25 - 1410 m × 30 m
                  </p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p>QFU 070°/250°</p>
                  <p>Bitume</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Arrivée */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-red-500">
        <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
          <TrendingDown size={20} className="text-red-600" />
          Atterrissage - LFPT
          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Base</span>
        </h4>
        
        {/* Conditions */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mountain size={16} />
              <span>Altitude</span>
            </div>
            <p className="font-bold">325 ft</p>
            <p className="text-xs text-gray-500">Base</p>
          </div>
          
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Thermometer size={16} />
              <span>Température</span>
            </div>
            <p className="font-bold">15°C</p>
            <p className="text-xs text-gray-500">ISA +0°</p>
          </div>
          
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Wind size={16} />
              <span>Facteur</span>
            </div>
            <p className="font-bold">×1.03</p>
          </div>
        </div>
        
        {/* Distances corrigées */}
        <div className="mb-4">
          <h5 className="text-sm font-bold text-gray-600 mb-2">Distances corrigées</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded p-3">
              <p className="text-xs text-gray-600">LD (Landing Distance)</p>
              <p className="text-xl font-bold">222 m</p>
              <p className="text-xs text-gray-500">(215 m std)</p>
            </div>
            <div className="bg-gray-100 rounded p-3">
              <p className="text-xs text-gray-600">LD UP (Flaps UP)</p>
              <p className="text-xl font-bold">407 m</p>
              <p className="text-xs text-gray-500">(395 m std)</p>
            </div>
          </div>
        </div>
        
        {/* Analyse pistes */}
        <div>
          <h5 className="text-sm font-bold text-gray-600 mb-2">Analyse des pistes disponibles</h5>
          <div className="space-y-2">
            <div className="bg-red-50 border border-red-300 rounded p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Piste 05/23 - 600 m × 18 m
                  </p>
                  <div className="text-xs text-red-600 ml-6 mt-1">
                    • Distance d'atterrissage insuffisante (LD: 222 m &gt; 600 m) ✓
                    <br />• Attention : piste courte, technique d'atterrissage court recommandée
                  </div>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p>QFU 050°/230°</p>
                  <p>Bitume</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-300 rounded p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-green-700 flex items-center gap-2">
                    <CheckCircle size={16} />
                    Piste 12/30 - 950 m × 30 m
                  </p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p>QFU 120°/300°</p>
                  <p>Bitume</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Alerte VAC */}
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-3">
          <p className="text-sm font-bold">⚠️ Données de pistes non disponibles</p>
          <p className="text-sm mt-1">
            Téléchargez la carte VAC dans l'onglet "Cartes VAC" pour obtenir l'analyse des pistes
          </p>
        </div>
      </div>
      
      {/* Formule */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-bold mb-2">📐 Formule de calcul utilisée :</p>
        <code className="bg-white px-3 py-2 rounded block font-mono text-sm">
          Distance corrigée = Distance standard × [1 + (Alt/1000 × 0.1) + (ΔT/10 × 0.1)]
        </code>
        <p className="text-sm mt-2">
          où ΔT = Température réelle - Température ISA (15°C - Alt × 0.002)
        </p>
      </div>
    </div>
  );
};

export default PerformanceModuleDemo;