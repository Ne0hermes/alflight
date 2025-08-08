import React, { useState } from 'react';
import { Calculator, Plane, TrendingUp, TrendingDown, Mountain, Thermometer, Wind, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { DataField, DataSourceBadge } from '../../shared/components';
import { sx } from '../../shared/styles/styleSystem';
import { PerformanceCalculator } from './components/PerformanceCalculator';

const PerformanceModule = () => {
  const [showAdvancedCalculator, setShowAdvancedCalculator] = useState(false);
  return (
    <div style={sx.spacing.p(6)}>
      {/* Header du module avec switch pour calculateur avancé */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.flex.start)}>
            <Calculator size={24} style={{ marginRight: '8px' }} />
            Performances de décollage et d'atterrissage
          </h2>
          <button
            onClick={() => setShowAdvancedCalculator(!showAdvancedCalculator)}
            style={{
              ...sx.components.button.base,
              ...sx.components.button.primary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Settings size={16} />
            {showAdvancedCalculator ? 'Calcul simple' : 'Calcul avec abaques'}
          </button>
        </div>
        
        {/* Info avion */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(4))}>
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
            <div>
              <h4 style={sx.text.bold}>F-GKXS</h4>
              <p style={sx.text.secondary}>Cessna 172S</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <DataField label="MTOW" value="1111" unit="kg" dataSource="static" size="sm" />
              <DataField label="Vitesse croisière" value="122" unit="kt" dataSource="static" size="sm" style={{ marginTop: '4px' }} />
            </div>
          </div>
          
          <div style={sx.combine(sx.components.card.base, sx.bg.white)}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>Performances standard (ISA, niveau mer)</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <DataField label="TOD" value="290" unit="m" dataSource="static" size="xs" />
              <DataField label="ASD" value="520" unit="m" dataSource="static" size="xs" />
              <DataField label="LD" value="215" unit="m" dataSource="static" size="xs" />
              <DataField label="LD UP" value="395" unit="m" dataSource="static" size="xs" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Départ */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6), { borderColor: '#10b981', borderWidth: '2px' })}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <TrendingUp size={20} style={{ color: '#10b981', marginRight: '8px' }} />
          Décollage - LFPN
          <DataSourceBadge source="vac" size="sm" inline={true} style={{ marginLeft: '8px' }} />
        </h4>
        
        {/* Conditions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <DataField
            label="Altitude"
            value="538"
            unit="ft"
            dataSource="vac"
            emphasis={true}
          />
          
          <DataField
            label="Température"
            value="22°C (ISA +8°)"
            dataSource="api"
            emphasis={true}
          />
          
          <DataField
            label="Facteur"
            value="×1.13"
            dataSource="calculated"
            emphasis={true}
          />
        </div>
        
        {/* Météo */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(4))}>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>🌤️ Conditions météo actuelles</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <DataField label="Vent" value="270° / 8kt" dataSource="api" size="sm" />
            <DataField label="Visibilité" value="10km" dataSource="api" size="sm" />
            <DataField label="QNH" value="1018 hPa" dataSource="api" size="sm" />
            <DataField label="Point de rosée" value="15°C" dataSource="api" size="sm" />
          </div>
        </div>
        
        {/* Distances corrigées */}
        <div style={sx.spacing.mb(4)}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.text.secondary, sx.spacing.mb(2))}>Distances corrigées</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>TOD (Take-off Distance)</p>
              <p style={sx.combine(sx.text.xl, sx.text.bold)}>328 m</p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>(290 m std)</p>
            </div>
            <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>ASD (Accelerate-Stop)</p>
              <p style={sx.combine(sx.text.xl, sx.text.bold)}>588 m</p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>(520 m std)</p>
            </div>
          </div>
        </div>
        
        {/* Analyse pistes */}
        <div>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.text.secondary, sx.spacing.mb(2))}>Analyse des pistes disponibles</h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.success)}>
              <CheckCircle size={16} />
              <div>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  Piste 07/25 - 1410 m × 30 m
                </p>
                <DataField
                  label="QFU"
                  value="070°/250°"
                  dataSource="vac"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
                <DataField
                  label="Surface"
                  value="Bitume"
                  dataSource="vac"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Arrivée */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6), { borderColor: '#ef4444', borderWidth: '2px' })}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <TrendingDown size={20} style={{ color: '#ef4444', marginRight: '8px' }} />
          Atterrissage - LFPT
          <DataSourceBadge source="static" size="sm" inline={true} style={{ marginLeft: '8px' }} />
        </h4>
        
        {/* Conditions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <DataField
            label="Altitude"
            value="325"
            unit="ft"
            dataSource="static"
            emphasis={true}
          />
          
          <DataField
            label="Température"
            value="15°C (ISA +0°)"
            dataSource="static"
            emphasis={true}
          />
          
          <DataField
            label="Facteur"
            value="×1.03"
            dataSource="calculated"
            emphasis={true}
          />
        </div>
        
        {/* Distances corrigées */}
        <div style={sx.spacing.mb(4)}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.text.secondary, sx.spacing.mb(2))}>Distances corrigées</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>LD (Landing Distance)</p>
              <p style={sx.combine(sx.text.xl, sx.text.bold)}>222 m</p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>(215 m std)</p>
            </div>
            <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>LD UP (Flaps UP)</p>
              <p style={sx.combine(sx.text.xl, sx.text.bold)}>407 m</p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>(395 m std)</p>
            </div>
          </div>
        </div>
        
        {/* Analyse pistes */}
        <div>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.text.secondary, sx.spacing.mb(2))}>Analyse des pistes disponibles</h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger)}>
              <AlertTriangle size={16} />
              <div>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  Piste 05/23 - 600 m × 18 m
                </p>
                <p style={sx.combine(sx.text.xs)}>
                  • Distance d'atterrissage insuffisante (LD: 222 m &gt; 600 m) ✓
                  <br />• Attention : piste courte, technique d'atterrissage court recommandée
                </p>
                <DataField
                  label="QFU"
                  value="050°/230°"
                  dataSource="static"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
                <DataField
                  label="Surface"
                  value="Bitume"
                  dataSource="static"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>
            
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.success)}>
              <CheckCircle size={16} />
              <div>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  Piste 12/30 - 950 m × 30 m
                </p>
                <DataField
                  label="QFU"
                  value="120°/300°"
                  dataSource="static"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
                <DataField
                  label="Surface"
                  value="Bitume"
                  dataSource="static"
                  size="xs"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Alerte VAC */}
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mt(3))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>⚠️ Données de pistes non disponibles</p>
            <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
              Téléchargez la carte VAC dans l'onglet "Cartes VAC" pour obtenir l'analyse des pistes
            </p>
          </div>
        </div>
      </div>
      
      {/* Formule */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
        <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>📐 Formule de calcul utilisée :</p>
        <code style={sx.combine(sx.bg.white, sx.spacing.p(3), sx.rounded.md, { display: 'block', fontFamily: 'monospace', fontSize: '13px' })}>
          Distance corrigée = Distance standard × [1 + (Alt/1000 × 0.1) + (ΔT/10 × 0.1)]
        </code>
        <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
          où ΔT = Température réelle - Température ISA (15°C - Alt × 0.002)
        </p>
      </div>
      
      {/* Calculateur avancé avec abaques */}
      {showAdvancedCalculator && (
        <div style={sx.spacing.mb(6)}>
          <PerformanceCalculator />
        </div>
      )}
    </div>
  );
};

export default PerformanceModule;