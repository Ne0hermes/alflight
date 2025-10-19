// src/features/navigation/components/TopOfDescent.jsx
import React, { useState, useMemo } from 'react';
import { TrendingDown, Calculator, Info, AlertTriangle, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

const TopOfDescent = ({ currentAltitude = 0, waypoints = [] }) => {
  const [targetAltitude, setTargetAltitude] = useState('');
  const [descentRate, setDescentRate] = useState(300); // ft/min par défaut
  const [groundSpeed, setGroundSpeed] = useState(100); // kt par défaut
  const [showDetails, setShowDetails] = useState(false);
  
  // Calcul du TOD
  const todCalculation = useMemo(() => {
    if (!targetAltitude || !descentRate || !groundSpeed) return null;
    
    const altitudeToDescent = currentAltitude - parseFloat(targetAltitude);
    
    // Si on est déjà en dessous de l'altitude cible
    if (altitudeToDescent <= 0) {
      return {
        error: true,
        message: "Vous êtes déjà en dessous de l'altitude cible"
      };
    }
    
    // Calcul du temps de descente en minutes
    const descentTimeMinutes = altitudeToDescent / descentRate;
    
    // Conversion de la vitesse sol en NM/min
    const groundSpeedNmPerMin = groundSpeed / 60;
    
    // Distance jusqu'au TOD en NM
    const distanceToTod = descentTimeMinutes * groundSpeedNmPerMin;
    
    // Angle de descente (pour info)
    const descentAngle = Math.atan((altitudeToDescent / 6076.12) / distanceToTod) * 180 / Math.PI;
    
    // Buffer de sécurité recommandé (10% ou 2 NM minimum)
    const safetyBuffer = Math.max(distanceToTod * 0.1, 2);
    
    return {
      altitudeToDescent,
      descentTimeMinutes,
      distanceToTod,
      distanceWithBuffer: distanceToTod + safetyBuffer,
      descentAngle,
      safetyBuffer,
      error: false
    };
  }, [currentAltitude, targetAltitude, descentRate, groundSpeed]);
  
  // Formater le temps en heures:minutes
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h${mins.toString().padStart(2, '0')}min`;
    }
    return `${mins} min`;
  };
  
  // Fonction pour obtenir l'altitude du dernier waypoint
  const getDestinationAltitude = () => {
    if (waypoints && waypoints.length > 0) {
      const lastWaypoint = waypoints[waypoints.length - 1];
      return lastWaypoint.elevation || 0;
    }
    return 0;
  };
  
  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      {/* En-tête */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
          <TrendingDown size={20} style={{ marginRight: '8px', color: '#ef4444' }} />
          Calcul du Top of Descent (TOD)
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          {showDetails ? 'Masquer' : 'Aide'}
        </button>
      </div>
      
      {/* Encart explicatif */}
      {showDetails && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
            <Info size={16} style={{ display: 'inline', marginRight: '6px' }} />
            Comment fonctionne le calcul du TOD ?
          </h4>
          <div style={sx.combine(sx.text.sm, { lineHeight: '1.6' })}>
            <p style={sx.spacing.mb(2)}>
              Le <strong>Top of Descent (TOD)</strong> est le point optimal où vous devez commencer votre descente 
              pour atteindre une altitude cible de manière contrôlée et confortable.
            </p>
            
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>📐 Formule utilisée :</h5>
            <div style={{
              backgroundColor: 'white',
              padding: '12px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px',
              marginBottom: '12px'
            }}>
              <div>Distance TOD (NM) = (Altitude à descendre / Taux de descente) × (Vitesse sol / 60)</div>
              <div style={{ marginTop: '8px' }}>
                Exemple : (5000 ft / 300 ft/min) × (100 kt / 60) = 27.8 NM
              </div>
            </div>
            
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>🎯 Règles pratiques :</h5>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li><strong>Taux standard :</strong> 300 ft/min pour le confort des passagers</li>
              <li><strong>Angle de descente :</strong> Idéalement entre 3° et 5°</li>
              <li><strong>Règle du 3:1 :</strong> 3 NM de distance pour 1000 ft d'altitude</li>
              <li><strong>Buffer de sécurité :</strong> Ajouter 10% ou 2 NM minimum</li>
            </ul>
            
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>⚠️ Facteurs à considérer :</h5>
            <ul style={{ marginLeft: '20px' }}>
              <li>Vent (face ou arrière) affecte la vitesse sol</li>
              <li>Restrictions ATC possibles</li>
              <li>Altitude de sécurité du terrain</li>
              <li>Configuration de l'avion (train, volets)</li>
              <li>Vitesse de descente maximale de l'avion</li>
            </ul>
          </div>
        </div>
      )}
      
      {/* Paramètres de calcul */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Altitude actuelle */}
        <div>
          <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1), { display: 'block' })}>
            Altitude actuelle (ft)
          </label>
          <input
            type="number"
            value={currentAltitude}
            readOnly
            style={{
              ...sx.components.input.base,
              backgroundColor: '#f3f4f6',
              cursor: 'not-allowed'
            }}
          />
        </div>
        
        {/* Altitude cible */}
        <div>
          <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1), { display: 'block' })}>
            Altitude cible (ft)
            {waypoints.length > 0 && (
              <button
                type="button"
                onClick={() => setTargetAltitude(getDestinationAltitude())}
                style={{
                  marginLeft: '8px',
                  fontSize: '11px',
                  color: '#3b82f6',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Utiliser altitude destination
              </button>
            )}
          </label>
          <input
            type="number"
            value={targetAltitude}
            onChange={(e) => setTargetAltitude(e.target.value)}
            placeholder="Ex: 2000"
            min="0"
            style={sx.components.input.base}
          />
        </div>
        
        {/* Taux de descente */}
        <div>
          <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1), { display: 'block' })}>
            Taux de descente (ft/min)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              value={descentRate}
              onChange={(e) => setDescentRate(e.target.value)}
              min="100"
              max="2000"
              step="50"
              style={{ ...sx.components.input.base, flex: 1 }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setDescentRate(300)}
                style={{
                  ...sx.components.button.base,
                  ...sx.components.button.secondary,
                  padding: '8px',
                  fontSize: '12px'
                }}
                title="Confort passagers"
              >
                300
              </button>
              <button
                onClick={() => setDescentRate(500)}
                style={{
                  ...sx.components.button.base,
                  ...sx.components.button.secondary,
                  padding: '8px',
                  fontSize: '12px'
                }}
                title="Standard"
              >
                500
              </button>
              <button
                onClick={() => setDescentRate(700)}
                style={{
                  ...sx.components.button.base,
                  ...sx.components.button.secondary,
                  padding: '8px',
                  fontSize: '12px'
                }}
                title="Rapide"
              >
                700
              </button>
            </div>
          </div>
        </div>
        
        {/* Vitesse sol */}
        <div>
          <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1), { display: 'block' })}>
            Vitesse sol (kt)
          </label>
          <input
            type="number"
            value={groundSpeed}
            onChange={(e) => setGroundSpeed(e.target.value)}
            min="50"
            max="500"
            step="10"
            style={sx.components.input.base}
          />
        </div>
      </div>
      
      {/* Résultats du calcul */}
      {todCalculation && !todCalculation.error && (
        <>
          {/* Résultat principal */}
          <div style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={sx.combine(sx.text.sm, sx.spacing.mb(1))}>
              COMMENCER LA DESCENTE À
            </div>
            <div style={sx.combine(sx.text['2xl'], sx.text.bold)}>
              {todCalculation.distanceWithBuffer.toFixed(1)} NM
            </div>
            <div style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
              de votre destination (incluant {todCalculation.safetyBuffer.toFixed(1)} NM de marge)
            </div>
          </div>
          
          {/* Détails du calcul */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>Altitude à descendre</p>
              <p style={sx.combine(sx.text.base, sx.text.bold)}>
                {todCalculation.altitudeToDescent.toLocaleString()} ft
              </p>
            </div>
            
            <div>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>Temps de descente</p>
              <p style={sx.combine(sx.text.base, sx.text.bold)}>
                {formatTime(todCalculation.descentTimeMinutes)}
              </p>
            </div>
            
            <div>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>Distance théorique</p>
              <p style={sx.combine(sx.text.base, sx.text.bold)}>
                {todCalculation.distanceToTod.toFixed(1)} NM
              </p>
            </div>
            
            <div>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>Angle de descente</p>
              <p style={sx.combine(sx.text.base, sx.text.bold)}>
                {todCalculation.descentAngle.toFixed(1)}°
                {todCalculation.descentAngle > 5 && (
                  <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '11px' }}>
                    (raide)
                  </span>
                )}
                {todCalculation.descentAngle < 2.5 && (
                  <span style={{ color: '#f59e0b', marginLeft: '8px', fontSize: '11px' }}>
                    (faible)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {/* Alertes et recommandations */}
          {todCalculation.descentAngle > 5 && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '12px'
            }}>
              <p style={sx.combine(sx.text.sm)}>
                <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px', color: '#ef4444' }} />
                <strong>Attention :</strong> L'angle de descente est supérieur à 5°. 
                Considérez un taux de descente plus faible ou commencez plus tôt.
              </p>
            </div>
          )}
          
          {todCalculation.descentAngle < 2.5 && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '12px'
            }}>
              <p style={sx.combine(sx.text.sm)}>
                <Info size={16} style={{ display: 'inline', marginRight: '6px', color: '#f59e0b' }} />
                <strong>Note :</strong> L'angle de descente est faible. 
                Vous pouvez augmenter le taux de descente ou commencer plus tard.
              </p>
            </div>
          )}
        </>
      )}
      
      {/* Message d'erreur */}
      {todCalculation && todCalculation.error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={24} style={{ color: '#ef4444', marginBottom: '8px' }} />
          <p style={sx.text.base}>{todCalculation.message}</p>
        </div>
      )}
      
      {/* Pas de calcul */}
      {!todCalculation && (
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Calculator size={24} style={{ color: '#6b7280', marginBottom: '8px' }} />
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Entrez une altitude cible pour calculer votre point de descente
          </p>
        </div>
      )}
    </div>

};

export default TopOfDescent;