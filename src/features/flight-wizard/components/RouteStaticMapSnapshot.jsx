// src/features/flight-wizard/components/RouteStaticMapSnapshot.jsx
/**
 * Carte statique (non-interactive) de la route avec noms des points affichés
 * Génère une image fixe de la route de navigation avec points VFR
 */
import React, { useRef, useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { vfrPointsExtractor } from '@services/vfrPointsExtractor';

export const RouteStaticMapSnapshot = ({ waypoints }) => {
  const canvasRef = useRef(null);
  const [vfrPoints, setVfrPoints] = useState([]);

  // Charger les points VFR depuis AIXM
  useEffect(() => {
    const loadVFRPoints = async () => {
      try {
        const allVFRPoints = await vfrPointsExtractor.loadVFRPoints();

        // Extraire les codes OACI des aérodromes dans les waypoints
        const aerodromeICAOs = waypoints
          .filter(wp => wp.name && wp.name.match(/^LF[A-Z]{2}$/))
          .map(wp => wp.name);

        // Filtrer les points VFR pour les aérodromes sélectionnés
        const filteredPoints = allVFRPoints.filter(point =>
          aerodromeICAOs.includes(point.aerodrome)
        );

        setVfrPoints(filteredPoints);
      } catch (error) {
        console.error('❌ Erreur chargement points VFR pour carte:', error);
      }
    };

    if (waypoints && waypoints.length > 0) {
      loadVFRPoints();
    }
  }, [waypoints]);

  useEffect(() => {
    if (!waypoints || waypoints.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Nettoyer le canvas
    ctx.clearRect(0, 0, width, height);

    // Fond de carte aéronautique (style carte OACI)
    // Dégradé bleu clair
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e6f2ff');
    gradient.addColorStop(1, '#d4e9ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Calculer les limites pour centrer la carte
    const lats = waypoints.map(wp => wp.lat).filter(lat => lat != null);
    const lons = waypoints.map(wp => wp.lon).filter(lon => lon != null);

    if (lats.length === 0 || lons.length === 0) {
      // Pas de coordonnées valides
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée de coordonnées disponible', width / 2, height / 2);
      return;
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Marges
    const margin = 80;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;

    // Fonction de conversion lat/lon vers pixels
    const latRange = maxLat - minLat || 0.1;
    const lonRange = maxLon - minLon || 0.1;

    const latToY = (lat) => height - margin - ((lat - minLat) / latRange) * plotHeight;
    const lonToX = (lon) => margin + ((lon - minLon) / lonRange) * plotWidth;

    // Dessiner la grille de fond
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = margin + (plotWidth / 10) * i;
      const y = margin + (plotHeight / 10) * i;

      // Lignes verticales
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();

      // Lignes horizontales
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }

    // Dessiner les segments de route
    ctx.strokeStyle = '#93163c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    waypoints.forEach((wp, index) => {
      if (wp.lat != null && wp.lon != null) {
        const x = lonToX(wp.lon);
        const y = latToY(wp.lat);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();

    // Dessiner les points VFR en premier (sous les waypoints)
    vfrPoints.forEach((vfrPoint) => {
      const lat = vfrPoint.coordinates?.lat;
      const lon = vfrPoint.coordinates?.lng;

      if (lat == null || lon == null) return;

      // Vérifier si le point est dans les limites de la carte
      if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return;

      const x = lonToX(lon);
      const y = latToY(lat);

      // Dessiner un triangle pour les points VFR
      const size = 6;
      ctx.fillStyle = '#f59e0b'; // Orange pour points VFR
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fill();

      // Bordure blanche
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nom du point VFR (petit, en italique)
      const vfrLabelText = vfrPoint.name;
      ctx.font = 'italic 10px sans-serif';
      const vfrTextMetrics = ctx.measureText(vfrLabelText);
      const vfrPadding = 3;

      // Fond semi-transparent
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(
        x - vfrTextMetrics.width / 2 - vfrPadding,
        y + size + 4,
        vfrTextMetrics.width + 2 * vfrPadding,
        14
      );

      // Texte du point VFR
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(vfrLabelText, x, y + size + 6);
    });

    // Dessiner les waypoints et leurs noms
    waypoints.forEach((wp, index) => {
      if (wp.lat == null || wp.lon == null) return;

      const x = lonToX(wp.lon);
      const y = latToY(wp.lat);

      // Déterminer la couleur selon le type
      let color = '#3b82f6'; // Par défaut bleu
      if (wp.type === 'departure') color = '#10b981'; // Vert pour départ
      if (wp.type === 'arrival') color = '#ef4444'; // Rouge pour arrivée

      // Dessiner le point
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Bordure blanche
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Numéro du waypoint
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index + 1, x, y);

      // Nom du point (au-dessus ou en dessous selon la position)
      const labelY = index % 2 === 0 ? y - 20 : y + 20;
      const labelText = wp.name || wp.icao || `Point ${index + 1}`;

      // Fond blanc pour le texte
      ctx.font = 'bold 12px sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const padding = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(
        x - textMetrics.width / 2 - padding,
        labelY - 8,
        textMetrics.width + 2 * padding,
        16
      );

      // Bordure autour du label
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        x - textMetrics.width / 2 - padding,
        labelY - 8,
        textMetrics.width + 2 * padding,
        16
      );

      // Texte du label
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x, labelY);
    });

    // Légende
    const legendY = height - 25;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';

    // Départ
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(margin, legendY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.fillText('Départ', margin + 12, legendY + 1);

    // Route
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(margin + 80, legendY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.fillText('Route', margin + 92, legendY + 1);

    // Arrivée
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(margin + 145, legendY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.fillText('Arrivée', margin + 157, legendY + 1);

    // Points VFR
    if (vfrPoints.length > 0) {
      const vfrX = margin + 225;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(vfrX, legendY - 5);
      ctx.lineTo(vfrX - 5, legendY + 5);
      ctx.lineTo(vfrX + 5, legendY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#374151';
      ctx.fillText('Points VFR', vfrX + 12, legendY + 1);
    }

  }, [waypoints, vfrPoints]);

  if (!waypoints || waypoints.length === 0) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        color: '#6b7280'
      }}>
        <MapIcon size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p style={{ fontSize: '14px' }}>Aucun waypoint défini pour afficher la carte</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: '#374151',
        fontWeight: '600'
      }}>
        <MapIcon size={18} />
        <span>Carte de navigation (vue statique)</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '4px',
          border: '1px solid #e5e7eb'
        }}
      />
      <p style={{
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '8px',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        📸 Image fixe de votre route • {waypoints.length} points
      </p>
    </div>
  );
};
