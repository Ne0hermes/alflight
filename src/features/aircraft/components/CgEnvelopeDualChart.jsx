// src/features/aircraft/components/CgEnvelopeDualChart.jsx
//
// Affiche l'enveloppe de centrage dans 2 représentations côte à côte :
//   - GAUCHE  : masse × CG (centre de gravité)
//   - DROITE  : masse × moment total (= masse × CG)
//
// Le pilote saisit ses points UNE SEULE FOIS (en CG dans Step3). La représentation
// en moment est dérivée automatiquement (conversion : moment = masse × CG).
//
// Objectif sécuritaire : double confirmation visuelle de l'enveloppe. Le pilote
// voit son enveloppe dans la représentation qu'il connaît habituellement (MANEX)
// ET sa représentation duale lors des simulations de chargement.

import React, { memo } from 'react';

// ─── Sous-composant générique pour un graphe d'enveloppe ─────────────────
const EnvelopeSubChart = ({
  title,
  xAxisLabel,
  yAxisLabel,
  envelopePoints,
  toX,
  toY,
  xRange,
  yRange,
  formatX,
  formatY,
  pointLabelSuffix,
  // 28/08 — couche « chargements de référence » : une polyligne par cas, un
  // sommet par bras de levier utilisé (devis cumulé), le dernier sommet étant
  // le centrage total. Le pilote saisit ses chargements juste en dessous de ce
  // graphique : ils se posent ici, sur l'enveloppe qu'il vient de définir.
  chargements = []
}) => {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  return (
    <div style={{ flex: 1, minWidth: 320, padding: '0 8px' }}>
      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
        {title}
      </div>
      <svg
        viewBox="0 0 500 300"
        style={{
          width: '100%',
          maxWidth: '500px',
          height: 'auto',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          backgroundColor: 'transparent',
          display: 'block',
          margin: '0 auto'
        }}
      >
        {/* Grille */}
        <defs>
          <pattern id={`grid-${title.replace(/\s/g, '')}`} width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="var(--border-subtle)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="300" fill={`url(#grid-${title.replace(/\s/g, '')})`} />

        {/* Axes */}
        <line x1="50" y1="250" x2="450" y2="250" stroke="var(--text-secondary)" strokeWidth="2" />
        <line x1="50" y1="50" x2="50" y2="250" stroke="var(--text-secondary)" strokeWidth="2" />

        {/* Labels axes */}
        <text x="250" y="282" textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
          {xAxisLabel}
        </text>
        <text
          x="14" y="150"
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          transform="rotate(-90 14 150)"
        >
          {yAxisLabel}
        </text>

        {/* Graduations X */}
        {(() => {
          const ticks = [];
          for (let i = 0; i <= 4; i++) {
            const xValue = xMin + (xMax - xMin) * (i / 4);
            const x = 50 + (400 * i) / 4;
            ticks.push(
              <g key={`x-${i}`}>
                <line x1={x} y1="250" x2={x} y2="255" stroke="var(--text-secondary)" strokeWidth="1" />
                <text x={x} y="268" textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                  {formatX(xValue)}
                </text>
              </g>
            );
          }
          return ticks;
        })()}

        {/* Graduations Y */}
        {(() => {
          const ticks = [];
          for (let i = 0; i <= 4; i++) {
            const yValue = yMin + (yMax - yMin) * (i / 4);
            const y = 250 - (200 * i) / 4;
            ticks.push(
              <g key={`y-${i}`}>
                <line x1="45" y1={y} x2="50" y2={y} stroke="var(--text-secondary)" strokeWidth="1" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                  {formatY(yValue)}
                </text>
              </g>
            );
          }
          return ticks;
        })()}

        {/* Enveloppe */}
        {envelopePoints.length >= 3 && (
          <polygon
            points={envelopePoints.map(p => `${toX(p.x)},${toY(p.y)}`).join(' ')}
            fill="rgba(34, 197, 94, 0.2)"
            stroke="var(--accent-primary)"
            strokeWidth="2"
          />
        )}

        {/* Points de l'enveloppe */}
        {envelopePoints.map((point, index) => (
          <g key={index}>
            <circle
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={4}
              fill={point.isForward ? 'var(--accent-primary)' : 'var(--color-red-critical)'}
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={toX(point.x)}
              y={toY(point.y) - 9}
              textAnchor="middle"
              fontSize={8}
              fill="var(--text-secondary)"
              fontWeight="bold"
            >
              {point.label}
            </text>
            <text
              x={toX(point.x)}
              y={toY(point.y) + 18}
              textAnchor="middle"
              fontSize={7}
              fill="var(--text-tertiary)"
            >
              {formatY(point.y)} / {formatX(point.x)}{pointLabelSuffix || ''}
            </text>
          </g>
        ))}

        {/* Chargements de référence — un sommet par bras de levier utilisé */}
        {chargements.map((c, ci) => {
          const sommets = (c.sommets || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
          if (sommets.length === 0) return null;
          const couleur = c.couleur || 'var(--accent-primary)';
          return (
            <g key={`chargement-${ci}`}>
              <polyline points={sommets.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
                fill="none" stroke={couleur} strokeWidth="1.4" strokeDasharray="3,3" opacity="0.75" />
              {sommets.map((p, pi) => (
                <g key={`s-${pi}`}>
                  <rect x={toX(p.x) - 3.2} y={toY(p.y) - 3.2} width="6.4" height="6.4"
                    transform={`rotate(45 ${toX(p.x)} ${toY(p.y)})`} fill={couleur} fillOpacity="0.9" />
                  <text x={toX(p.x)} y={pi % 2 === 0 ? toY(p.y) - 6 : toY(p.y) + 13}
                    textAnchor="middle" fontSize="7" fill={couleur}>{p.label}</text>
                </g>
              ))}
              {sommets.length > 0 && (() => {
                const d = sommets[sommets.length - 1];
                return <circle cx={toX(d.x)} cy={toY(d.y)} r="5" fill="none" stroke={couleur} strokeWidth="2" />;
              })()}
            </g>
          );
        })}

        {/* Message si insuffisant */}
        {envelopePoints.length < 3 && (
          <text x="250" y="150" textAnchor="middle" fontSize="13" fill="var(--text-tertiary)">
            Saisissez au moins 3 points
          </text>
        )}
      </svg>
    </div>
  );
};

const CGEnvelopeDualChart = memo(({ cgEnvelope, massUnit = 'kg', armUnit = 'mm', chargements = [] }) => {
  // ─── Extraction des points bruts ───────────────────────────────────────
  const forwardPoints = (cgEnvelope?.forwardPoints || [])
    .map(p => ({
      weight: parseFloat(p.weight) || 0,
      cg: parseFloat(p.cg) || 0
    }))
    .filter(p => p.weight > 0 && p.cg > 0);

  const aftMinWeight = parseFloat(cgEnvelope?.aftMinWeight) || 0;
  const aftMaxWeight = parseFloat(cgEnvelope?.aftMaxWeight) || 0;
  // Nouveau modèle : 2 CG indépendants. Rétro-compat : si aftMinCG/aftMaxCG
  // ne sont pas définis, on utilise aftCG (ancien format) pour les deux.
  const legacyAftCG = parseFloat(cgEnvelope?.aftCG) || 0;
  const aftMinCG = parseFloat(cgEnvelope?.aftMinCG) || legacyAftCG;
  const aftMaxCG = parseFloat(cgEnvelope?.aftMaxCG) || legacyAftCG;

  // ─── Construction des points de l'enveloppe (sens horaire) ─────────────
  // Format universel : { x: <valeur axe X>, y: <masse>, label, isForward }
  // Pour le graphe CG  : x = CG
  // Pour le graphe Moment : x = masse × CG (= moment)
  const buildPoints = (useMoment) => {
    const points = [];
    const sortedForward = [...forwardPoints].sort((a, b) => a.weight - b.weight);
    sortedForward.forEach((p, i) => {
      points.push({
        x: useMoment ? p.weight * p.cg : p.cg,
        y: p.weight,
        label: `Fwd ${i + 1}`,
        isForward: true
      });
    });
    // Aft Max : utilise aftMaxCG (peut être différent de aftMinCG)
    if (aftMaxWeight > 0 && aftMaxCG > 0) {
      points.push({
        x: useMoment ? aftMaxWeight * aftMaxCG : aftMaxCG,
        y: aftMaxWeight,
        label: 'Aft Max',
        isForward: false
      });
    }
    // Aft Min : utilise aftMinCG. Toujours ajouter (même si égal à Max) car
    // c'est un sommet distinct du polygone.
    if (aftMinWeight > 0 && aftMinCG > 0) {
      points.push({
        x: useMoment ? aftMinWeight * aftMinCG : aftMinCG,
        y: aftMinWeight,
        label: 'Aft Min',
        isForward: false
      });
    }
    return points;
  };

  const cgPoints = buildPoints(false);
  const momentPoints = buildPoints(true);

  // ─── Échelles communes ─────────────────────────────────────────────────
  // 28/08 — les sommets des chargements entrent dans les échelles : ce sont de
  // vraies masses et de vrais centrages de cet appareil. Sans cela, l'avion à
  // vide sort par le bas sur les fiches dont l'enveloppe commence au-dessus de
  // la masse à vide (cas des DA40), et le devis démarre hors du cadre.
  const sommetsCharges = chargements.flatMap((c) => c.sommets || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const allWeights = [...cgPoints, ...momentPoints].map(p => p.y).concat(sommetsCharges.map((p) => p.y));
  const yMin = allWeights.length > 0 ? Math.min(...allWeights) - 50 : 900;
  const yMax = allWeights.length > 0 ? Math.max(...allWeights) + 50 : 1400;

  // Échelles X séparées pour les 2 graphes
  const cgXs = cgPoints.map(p => p.x).concat(sommetsCharges.map((p) => p.x));
  const momentXs = momentPoints.map(p => p.x);
  const cgXMin = cgXs.length > 0 ? Math.min(...cgXs) - (Math.max(...cgXs) - Math.min(...cgXs)) * 0.05 - 0.001 : 0;
  const cgXMax = cgXs.length > 0 ? Math.max(...cgXs) + (Math.max(...cgXs) - Math.min(...cgXs)) * 0.05 + 0.001 : 1;
  const momentXMin = momentXs.length > 0 ? Math.min(...momentXs) * 0.95 : 0;
  const momentXMax = momentXs.length > 0 ? Math.max(...momentXs) * 1.05 + 1 : 1;

  const toY = (yMin, yMax) => (y) => 250 - (y - yMin) / (yMax - yMin) * 200;
  const toX = (xMin, xMax) => (x) => 50 + (x - xMin) / (xMax - xMin) * 400;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        alignItems: 'flex-start',
        marginTop: 16,
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
        <EnvelopeSubChart
          title={`Enveloppe — base CG (bras de levier)`}
          xAxisLabel={`CG (${armUnit})`}
          yAxisLabel={`Masse (${massUnit})`}
          envelopePoints={cgPoints}
          toX={toX(cgXMin, cgXMax)}
          toY={toY(yMin, yMax)}
          xRange={[cgXMin, cgXMax]}
          yRange={[yMin, yMax]}
          formatX={(v) => v.toFixed(armUnit === 'mm' ? 0 : armUnit === 'cm' ? 1 : 3)}
          formatY={(v) => Math.round(v)}
          pointLabelSuffix={armUnit}
        />
        <EnvelopeSubChart
          title={`Enveloppe — base Moment`}
          xAxisLabel={`Moment (${massUnit}·${armUnit})`}
          yAxisLabel={`Masse (${massUnit})`}
          envelopePoints={momentPoints}
          toX={toX(momentXMin, momentXMax)}
          toY={toY(yMin, yMax)}
          xRange={[momentXMin, momentXMax]}
          yRange={[yMin, yMax]}
          formatX={(v) => Math.round(v)}
          formatY={(v) => Math.round(v)}
          pointLabelSuffix={`${massUnit}·${armUnit}`}
        />
    </div>
  );
});

CGEnvelopeDualChart.displayName = 'CGEnvelopeDualChart';

export default CGEnvelopeDualChart;
