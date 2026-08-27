// src/features/weight-balance/components/WeightBalanceChart.jsx
// ============================================================================
// DOUBLE ENVELOPPE — double vérification masse & centrage.
//   1) Masse × CG (centre de gravité, mm)
//   2) Masse × Moment (= masse × CG, kg.m) — DÉRIVÉE automatiquement
// Les mêmes scénarios et les MÊMES cartouches (masse / moment / CG) sont
// affichés sur les 2 graphes : le pilote vérifie sa conformité dans les deux
// représentations (celle du MANEX + sa duale). Le pilote ne saisit l'enveloppe
// qu'UNE fois (en CG, dans l'éditeur avion) ; le moment est calculé ici.
// ============================================================================
import React, { memo, useMemo, useState } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { tokens } from '@shared/styles/designSystem';
import { SCENARIO_COLORS } from '../scenarioColors';
import { isWithinEnvelope } from '@utils/cgEnvelope';
import { evaluateAllWbReferenceCases } from '@alflight/calc-engine/wb/referenceCases';

// Couleurs de la série « cas de référence M&C » (jetons clair/sombre définis
// dans index.css) — jamais confondues avec les 4 scénarios du vol.
const WB_REF_COLORS = ['var(--wb-ref-1)', 'var(--wb-ref-2)', 'var(--wb-ref-3)'];

// showReferenceCases (27/08) : état INITIAL de la couche « cas de référence ».
// Faux partout en préparation de vol — c'est une aide à la vérification de la
// fiche avion, que le pilote allume par la case sous le graphique. Un appelant
// dont le métier EST la vérification (atelier de la fiche, banc) peut l'ouvrir
// d'emblée en passant la prop.
export const WeightBalanceChart = memo(({ aircraft, scenarios, calculations, showReferenceCases = false }) => {
  // Source unique : l'enveloppe CG saisie dans « Gestion des avions ».
  const cgEnvelope = aircraft?.cgEnvelope;

  const hasCgEnvelopeData = cgEnvelope &&
    cgEnvelope.forwardPoints &&
    cgEnvelope.forwardPoints.length > 0 &&
    (cgEnvelope.aftCG || cgEnvelope.aftMinCG || cgEnvelope.aftMaxCG);

  // ─── Cas de référence M&C (banc de test — demande pilote 26-27/08/2026) ──
  // Rejoués par le VRAI moteur (evaluateAllWbReferenceCases → computeWeight-
  // Balance) : cas AUTO de la fiche de pesée + cas manuels stockés dans
  // aircraft.wbReferenceCases. Chaque cas évaluable trace UN POINT PAR BRAS
  // DE LEVIER utilisé + le point résultant (CG total) + le verdict d'écart.
  // 27/08 — appel PROTÉGÉ : le banc s'exécute avant les garde-fous d'affichage
  // du composant ; une fiche importée mal formée y levait une exception qui
  // emportait le graphique entier, enveloppe comprise. Le banc peut être
  // indisponible, le graphe de centrage jamais.
  const refCases = useMemo(() => {
    if (!aircraft) return [];
    try { return evaluateAllWbReferenceCases(aircraft); } catch { return []; }
  }, [aircraft]);
  // 27/08 — on ne trace QUE ce que le moteur a réellement vérifié. Un cas au
  // statut 'error' conserve ses points et son point résultant (utile à lire
  // dans la liste), mais le tracer à l'identique d'un cas validé revenait à
  // présenter comme vérifié un cas que le moteur a refusé de juger.
  const drawableRefCases = useMemo(
    () => refCases.filter((c) => (c.status === 'pass' || c.status === 'fail') && c.resultPoint && c.points.length > 0),
    [refCases]
  );
  // Le cas AUTO de la pesée existe pour TOUS les avions : s'il suffisait à
  // afficher le bandeau, les 13 fiches montreraient un bloc « Cas de référence »
  // en préparation de vol sans que le pilote ait rien saisi. Seuls les cas
  // STOCKÉS ouvrent le bloc.
  const storedRefCases = useMemo(() => refCases.filter((c) => !c.auto), [refCases]);
  // 27/08 — ÉTEINT PAR DÉFAUT. Cette couche est une aide à la VÉRIFICATION de
  // la fiche avion, pas du mobilier de préparation de vol : allumée d'office,
  // elle se superposait au point de chargement du jour sur l'écran Masse &
  // centrage ET dans le récapitulatif imprimé, sans que le pilote l'ait
  // demandée. Elle s'allume à la demande, par la case sous le graphique.
  const [showRefCases, setShowRefCases] = useState(showReferenceCases);
  const refVisible = showRefCases && drawableRefCases.length > 0;

  // ─── Échelles CG (mm) + masse (kg) ────────────────────────────────────────
  const scales = useMemo(() => {
    if (!aircraft || !cgEnvelope?.forwardPoints) {
      return { cgMin: 0, cgMax: 1, weightMin: 0, weightMax: 1 };
    }
    const forwardCGs = cgEnvelope.forwardPoints
      .map(p => parseFloat(p.cg))
      .filter(cg => !isNaN(cg));
    const legacyAftCG = parseFloat(cgEnvelope.aftCG);
    const aftCGs = [cgEnvelope.aftMinCG, cgEnvelope.aftMaxCG, legacyAftCG]
      .map((v) => parseFloat(v)).filter((v) => !isNaN(v));

    const cgMin = Math.min(...forwardCGs, ...aftCGs);
    const cgMax = Math.max(...forwardCGs, ...aftCGs);
    const cgRange = cgMax - cgMin;

    const envelopeWeights = [
      ...forwardCGs.length > 0 ? cgEnvelope.forwardPoints.map(p => parseFloat(p.weight)).filter(w => !isNaN(w)) : [],
      parseFloat(cgEnvelope.aftMinWeight),
      parseFloat(cgEnvelope.aftMaxWeight)
    ].filter(w => !isNaN(w) && w > 0);

    const operationalLimits = [
      parseFloat(aircraft.weights?.minTakeoffWeight || aircraft.minTakeoffWeight),
      parseFloat(aircraft.weights?.mtow || aircraft.maxTakeoffWeight),
      parseFloat(aircraft.weights?.mlw || aircraft.maxLandingWeight)
    ].filter(w => !isNaN(w) && w > 0);

    const allWeights = [...envelopeWeights, ...operationalLimits];
    const minWeight = allWeights.length > 0 ? Math.min(...allWeights) : 600;
    const maxWeight = allWeights.length > 0 ? Math.max(...allWeights) : 1150;

    const base = {
      cgMin: (cgMin - cgRange * 0.1) * 1000,
      cgMax: (cgMax + cgRange * 0.1) * 1000,
      weightMin: minWeight - 50,
      weightMax: maxWeight + 50
    };

    // 27/08 — LES POSTES NE PILOTENT PLUS LES ÉCHELLES. La version précédente
    // étendait les deux axes pour englober CHAQUE poste à son bras. Or un poste,
    // ce sont 20 kg de bagages à 1,90 m, face à une enveloppe qui vit entre
    // 0,20 et 0,56 m : l'axe des centrages était dilaté d'un facteur 4 et
    // l'enveloppe — la seule chose que le pilote doit lire ici — se retrouvait
    // écrasée sur un cinquième de la largeur. Seuls le CG RÉSULTANT du cas et
    // le CG ATTENDU peuvent désormais élargir le cadre : ce sont des centrages,
    // homogènes à l'enveloppe, et ils restent dans son voisinage. Les points de
    // postes hors cadre sont simplement écrêtés au rendu.
    if (refVisible) {
      const cgVals = [];
      const wVals = [];
      drawableRefCases.forEach((c) => {
        cgVals.push(c.resultPoint.cg * 1000);
        wVals.push(c.resultPoint.w);
        if (Number.isFinite(c.cgExpected)) cgVals.push(c.cgExpected * 1000);
      });
      if (cgVals.length > 0) {
        base.cgMin = Math.min(base.cgMin, Math.min(...cgVals) - 20);
        base.cgMax = Math.max(base.cgMax, Math.max(...cgVals) + 20);
        base.weightMin = Math.min(base.weightMin, Math.min(...wVals) - 20);
        base.weightMax = Math.max(base.weightMax, Math.max(...wVals) + 20);
      }
    }
    return base;
  }, [aircraft, cgEnvelope, refVisible, drawableRefCases]);

  // Masse → Y (commun aux 2 graphes)
  const toSvgY = (w) => {
    const weightValue = isNaN(w) ? 0 : w;
    return 350 - (weightValue - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300;
  };

  // Verdict d'appartenance à l'enveloppe — SOURCE UNIQUE (utils/cgEnvelope),
  // identique au moteur weightBalanceStore : limite avant variable + arrière
  // 2-points (A2/A3). Enveloppe absente/indéterminée → fail-closed (false).
  const isPointWithinEnvelope = (weight, cg) => isWithinEnvelope(cgEnvelope, weight, cg) === true;

  const criticalScenariosWithinLimits = useMemo(() => {
    if (!scenarios) return false;
    const criticalScenarios = ['toCrm', 'landing'];
    return criticalScenarios.every(key => {
      const scenario = scenarios[key];
      // Number.isFinite : un scénario INDISPONIBLE (w/cg null) est écarté —
      // isNaN(null) vaut false et laisserait passer un point fantôme (crash .toFixed).
      if (!scenario || !Number.isFinite(scenario.w) || !Number.isFinite(scenario.cg)) return false;
      return isPointWithinEnvelope(scenario.w, scenario.cg);
    });
  }, [scenarios]);

  const hasNonCriticalWarnings = useMemo(() => {
    if (!scenarios) return false;
    const nonCriticalScenarios = ['zfw', 'fulltank'];
    return nonCriticalScenarios.some(key => {
      const scenario = scenarios[key];
      // Number.isFinite : un scénario INDISPONIBLE (w/cg null) est écarté —
      // isNaN(null) vaut false et laisserait passer un point fantôme (crash .toFixed).
      if (!scenario || !Number.isFinite(scenario.w) || !Number.isFinite(scenario.cg)) return false;
      return !isPointWithinEnvelope(scenario.w, scenario.cg);
    });
  }, [scenarios]);

  // Sommets de l'enveloppe (masse, cg) — communs aux 2 représentations.
  const envelopeData = useMemo(() => {
    if (!cgEnvelope?.forwardPoints) return [];
    const sortedForwardPoints = [...cgEnvelope.forwardPoints]
      .filter(p => p.weight && p.cg && !isNaN(parseFloat(p.weight)) && !isNaN(parseFloat(p.cg)))
      .map(p => ({ weight: parseFloat(p.weight), cg: parseFloat(p.cg) }))
      .sort((a, b) => a.weight - b.weight);

    const points = [];
    sortedForwardPoints.forEach((p, i) => {
      points.push({ w: p.weight, cg: p.cg, label: `Forward ${i + 1}` });
    });

    const aftMaxWeight = parseFloat(cgEnvelope.aftMaxWeight);
    const aftMinWeight = parseFloat(cgEnvelope.aftMinWeight);
    // Modèle arrière 2-points (rétro-compat aftCG constant) — A3.
    const legacyAftCG = parseFloat(cgEnvelope.aftCG);
    const aftMaxCG = !isNaN(parseFloat(cgEnvelope.aftMaxCG)) ? parseFloat(cgEnvelope.aftMaxCG) : legacyAftCG;
    const aftMinCG = !isNaN(parseFloat(cgEnvelope.aftMinCG)) ? parseFloat(cgEnvelope.aftMinCG) : legacyAftCG;

    if (!isNaN(aftMaxWeight) && aftMaxWeight > 0 && !isNaN(aftMaxCG)) {
      points.push({ w: aftMaxWeight, cg: aftMaxCG, label: 'Aft Max' });
    }
    if (!isNaN(aftMinWeight) && aftMinWeight > 0 && !isNaN(aftMinCG) && aftMinWeight !== aftMaxWeight) {
      points.push({ w: aftMinWeight, cg: aftMinCG, label: 'Aft Min' });
    }
    return points;
  }, [aircraft, cgEnvelope]);

  // ─── Échelle MOMENT (kg.m) — dérivée : moment = masse × CG ─────────────────
  const momentScale = useMemo(() => {
    const moments = envelopeData.map(p => p.w * p.cg);
    ['fulltank', 'toCrm', 'landing', 'zfw'].forEach(k => {
      const s = scenarios?.[k];
      if (s && !isNaN(s.w) && !isNaN(s.cg)) moments.push(s.w * s.cg);
    });
    // 27/08 — même correction que sur l'échelle CG : le moment d'un POSTE isolé
    // (20 kg × 1,90 m = 38 kg·m, contre 300 à 600 kg·m pour l'enveloppe) tirait
    // l'axe vers le bas et tassait l'enveloppe. Seul le moment RÉSULTANT du cas
    // entre dans le cadre — il est homogène à ce que l'axe représente.
    if (refVisible) {
      drawableRefCases.forEach((c) => {
        moments.push(c.resultPoint.w * c.resultPoint.cg);
      });
    }
    const valid = moments.filter(m => !isNaN(m) && m > 0);
    if (valid.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = (max - min) || max || 1;
    return { min: Math.max(0, min - range * 0.1), max: max + range * 0.1 };
  }, [envelopeData, scenarios, refVisible, drawableRefCases]);

  // ─── Garde-fous d'UI APRÈS tous les hooks ─────────────────────────────────
  if (!aircraft || !scenarios || !calculations) {
    return (
      <div style={sx.combine(sx.flex.center, sx.spacing.p(8), sx.bg.gray)}>
        <p style={sx.text.secondary}>Sélectionnez un avion pour afficher le graphique</p>
      </div>
    );
  }

  if (!hasCgEnvelopeData) {
    return (
      <div style={sx.spacing.mt(8)}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          Enveloppe de centrage
        </h3>
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <p style={sx.combine(sx.text.lg, sx.text.bold)}>
            Données d'enveloppe de centrage manquantes
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
            Veuillez configurer l'enveloppe de centrage dans l'onglet <strong>"Gestion des avions"</strong> →
            Section <strong>"CENTER OF GRAVITY - Enveloppe de centrage"</strong>
          </p>
          <ul style={{ marginTop: tokens.spacing[2], paddingLeft: tokens.spacing[5] }}>
            <li>Ajoutez au moins un point CG avant (Most Forward CG)</li>
            <li>Définissez les limites CG arrière (Most Rearward CG)</li>
          </ul>
        </div>
      </div>
    );
  }

  // Couleurs des 4 scénarios (source unique partagée avec les cartes).
  const scenarioConfig = [
    { key: 'fulltank', label: 'Réservoirs pleins', color: SCENARIO_COLORS.fulltank },
    { key: 'toCrm', label: 'Masse au décollage (FOB)', color: SCENARIO_COLORS.toCrm },
    { key: 'landing', label: 'Masse à l\'atterrissage', color: SCENARIO_COLORS.landing },
    { key: 'zfw', label: 'Masse sans carburant (ZFW)', color: SCENARIO_COLORS.zfw }
  ];

  // Limites opérationnelles (lignes horizontales = masse → identiques sur les 2 graphes).
  const getValidWeight = (...values) => {
    for (const val of values) {
      if (val === null || val === undefined || val === '') continue;
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return NaN;
  };
  const minTakeoffWeight = getValidWeight(aircraft.weights?.minTakeoffWeight, aircraft.minTakeoffWeight);
  const maxTakeoffWeight = getValidWeight(aircraft.weights?.mtow, aircraft.maxTakeoffWeight, aircraft.mtow, aircraft.weights?.maxTakeoffWeight);
  const maxLandingWeight = getValidWeight(aircraft.weights?.mlw, aircraft.maxLandingWeight, aircraft.mlw, aircraft.weights?.maxLandingWeight);

  // ─── Un graphe complet, paramétré par l'axe X ─────────────────────────────
  //  xOf(w, cg) → valeur brute sur l'axe X ; toX(brut) → pixel.
  const renderDiagram = ({ chartKey, title, xAxisLabel, xUnit, xMin, xMax, toX, xOf, xFormat }) => {
    const gridId = `grid-${chartKey}`;
    const envelopePoints = envelopeData.map(p => `${toX(xOf(p.w, p.cg))},${toSvgY(p.w)}`).join(' ');
    const scenarioPath = (() => {
      const pts = ['fulltank', 'toCrm', 'landing', 'zfw']
        .map(key => scenarios[key])
        .filter(s => s && Number.isFinite(s.cg) && Number.isFinite(s.w))
        .map(s => `${toX(xOf(s.w, s.cg))},${toSvgY(s.w)}`);
      return pts.length > 1 ? `M ${pts.join(' L ')}` : '';
    })();

    return (
      <div style={{ marginBottom: tokens.spacing[2] }}>
        <svg viewBox="0 0 600 420" style={{ width: '100%', maxWidth: '760px', height: 'auto', margin: '0 auto', display: 'block' }}>
          <defs>
            <pattern id={gridId} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--border-subtle)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="420" fill={`url(#${gridId})`} />

          {/* Lignes de grille secondaires */}
          {Array.from({ length: 5 }, (_, k) => k + 1).map(i => (
            <line key={`vg-${i}`} x1={50 + (500 * i) / 6} y1="50" x2={50 + (500 * i) / 6} y2="350" stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2,2" />
          ))}
          {Array.from({ length: 5 }, (_, k) => k + 1).map(i => (
            <line key={`hg-${i}`} x1="50" y1={350 - (300 * i) / 6} x2="550" y2={350 - (300 * i) / 6} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2,2" />
          ))}

          {/* Axes */}
          <line x1="50" y1="350" x2="550" y2="350" stroke="var(--text-secondary)" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="350" stroke="var(--text-secondary)" strokeWidth="2" />

          {/* Graduations X */}
          {Array.from({ length: 7 }, (_, i) => i).map(i => {
            const xValue = xMin + (xMax - xMin) * (i / 6);
            const x = 50 + (500 * i) / 6;
            return (
              <g key={`x-tick-${i}`}>
                <line x1={x} y1="350" x2={x} y2="355" stroke="var(--text-secondary)" strokeWidth="1" />
                <text x={x} y="365" textAnchor="middle" fontSize="8" fill="var(--text-secondary)">{xFormat(xValue)}</text>
              </g>
            );
          })}
          <text x="520" y="365" textAnchor="middle" fontSize="8" fill="var(--text-tertiary)" fontStyle="italic">({xUnit})</text>

          {/* Graduations Y (masse) */}
          {Array.from({ length: 7 }, (_, i) => i).map(i => {
            const weightValue = scales.weightMin + (scales.weightMax - scales.weightMin) * (i / 6);
            const y = 350 - (300 * i) / 6;
            return (
              <g key={`y-tick-${i}`}>
                <line x1="45" y1={y} x2="50" y2={y} stroke="var(--text-secondary)" strokeWidth="1" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-secondary)">{Math.round(weightValue)}</text>
              </g>
            );
          })}
          <text x="40" y="60" textAnchor="end" fontSize="8" fill="var(--text-tertiary)" fontStyle="italic">(kg)</text>

          {/* Labels axes */}
          <text x="300" y="385" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{xAxisLabel}</text>
          <text x="15" y="200" textAnchor="middle" fontSize="10" fill="var(--text-secondary)" transform="rotate(-90 15 200)">Masse (kg)</text>

          {/* Limites opérationnelles (horizontales). Les ÉTIQUETTES sont
              dé-superposées verticalement quand deux limites ont une masse
              identique/proche (ex. MTOW = MLW aux limites hautes) — sinon les
              textes se chevauchaient et devenaient illisibles. Les LIGNES
              restent à leur masse réelle ; un fin trait de rappel relie chaque
              étiquette décalée à sa ligne. */}
          {(() => {
            const items = [
              !isNaN(minTakeoffWeight) && { text: `Masse min: ${minTakeoffWeight} kg`, w: minTakeoffWeight, color: 'var(--color-red-critical)', dash: '8,4' },
              !isNaN(maxTakeoffWeight) && { text: `MTOW: ${maxTakeoffWeight} kg`, w: maxTakeoffWeight, color: 'var(--color-red-critical)', dash: '8,4' },
              !isNaN(maxLandingWeight) && { text: `MLW: ${maxLandingWeight} kg`, w: maxLandingWeight, color: 'var(--accent-primary)', dash: '4,4' }
            ].filter(Boolean).map(it => ({ ...it, lineY: toSvgY(it.w) }));

            // Dé-collision : on trie par y et on écarte les étiquettes trop
            // proches d'un gap mini (~ hauteur d'une ligne de texte).
            const MIN_GAP = 11;
            [...items].sort((a, b) => a.lineY - b.lineY).reduce((lastY, it) => {
              let y = it.lineY + 3;
              if (y - lastY < MIN_GAP) y = lastY + MIN_GAP;
              it.labelY = y;
              return y;
            }, -Infinity);

            return items.map((it, i) => (
              <g key={`limit-${i}`}>
                <line x1="50" y1={it.lineY} x2="550" y2={it.lineY} stroke={it.color} strokeWidth="2" strokeDasharray={it.dash} />
                {Math.abs(it.labelY - (it.lineY + 3)) > 0.5 && (
                  <line x1="550" y1={it.lineY} x2="555" y2={it.labelY - 3} stroke={it.color} strokeWidth="0.5" opacity="0.6" />
                )}
                <text x="557" y={it.labelY} fontSize="9" fill={it.color} fontWeight="600">{it.text}</text>
              </g>
            ));
          })()}

          {/* Enveloppe */}
          <polygon points={envelopePoints} fill="var(--accent-soft)" fillOpacity="0.5" stroke="var(--accent-primary)" strokeWidth="2" />

          {/* Labels des sommets de l'enveloppe */}
          {envelopeData.map((point, index) => {
            const x = toX(xOf(point.w, point.cg));
            const y = toSvgY(point.w);
            let xAdjust = x;
            let yAdjust = y - 5;
            if (x < 100) xAdjust = x + 30;
            else if (x > 500) xAdjust = x - 30;
            if (y < 80) yAdjust = y + 15;
            else if (y > 320) yAdjust = y - 10;
            return (
              <text key={`env-${index}`} x={xAdjust} y={yAdjust} fontSize="8" fill="var(--text-tertiary)" textAnchor="middle" fontStyle="italic">
                {point.w.toFixed(0)}kg / {xFormat(xOf(point.w, point.cg))}{xUnit}
              </text>
            );
          })}

          {/* ─── CAS DE RÉFÉRENCE M&C — un point PAR BRAS DE LEVIER utilisé
              (losange : masse du poste À SON bras), reliés au point résultant
              (double cercle : CG total calculé) ; croix = CG ATTENDU du
              manuel. Demande pilote 26-27/08/2026 : vérifier d'un coup d'œil
              que chaque poste tombe où le manuel le place. */}
          {refVisible && drawableRefCases.map((c, ci) => {
            const color = WB_REF_COLORS[ci % WB_REF_COLORS.length];
            const verdictColor = c.status === 'fail' ? 'var(--color-red-critical)' : color;
            const rx = toX(xOf(c.resultPoint.w, c.resultPoint.cg));
            const ry = toSvgY(c.resultPoint.w);
            return (
              <g key={`refcase-${c.id}`}>
                {c.points.map((p) => {
                  const px = toX(xOf(p.masse, p.bras));
                  const py = toSvgY(p.masse);
                  return (
                    <line key={`spoke-${p.key}`} x1={px} y1={py} x2={rx} y2={ry} stroke={color} strokeWidth="1" strokeDasharray="2,3" opacity="0.45" />
                  );
                })}
                {c.points.map((p, pi) => {
                  const px = toX(xOf(p.masse, p.bras));
                  const py = toSvgY(p.masse);
                  return (
                    <g key={`pt-${p.key}`}>
                      <rect x={px - 3} y={py - 3} width="6" height="6" transform={`rotate(45 ${px} ${py})`} fill={color} fillOpacity="0.9" />
                      {/* Étiquettes alternées haut/bas pour limiter les collisions
                          entre postes voisins (sièges à bras proches). */}
                      <text x={px} y={pi % 2 === 0 ? py - 6 : py + 13} textAnchor="middle" fontSize="7" fill={color}>
                        {p.label} · {p.masse.toFixed(0)} kg
                      </text>
                    </g>
                  );
                })}
                {Number.isFinite(c.cgExpected) && (() => {
                  const ex = toX(xOf(c.resultPoint.w, c.cgExpected));
                  return (
                    <g>
                      <line x1={ex - 4} y1={ry - 4} x2={ex + 4} y2={ry + 4} stroke={verdictColor} strokeWidth="1.5" />
                      <line x1={ex - 4} y1={ry + 4} x2={ex + 4} y2={ry - 4} stroke={verdictColor} strokeWidth="1.5" />
                    </g>
                  );
                })()}
                <circle cx={rx} cy={ry} r="5" fill="none" stroke={verdictColor} strokeWidth="2" />
                <circle cx={rx} cy={ry} r="1.6" fill={verdictColor} />
                <text x={rx} y={ry - 9} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={verdictColor}>
                  {c.label}{c.deviationMm != null ? ` — écart ${c.deviationMm.toFixed(1)} mm ${c.status === 'pass' ? '✓' : '✗'}` : ''}
                </text>
              </g>
            );
          })}

          {/* Ligne reliant les scénarios */}
          {scenarioPath && (
            <path d={scenarioPath} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="5,5" />
          )}

          {/* Points des scénarios + cartouches (masse / moment / CG — IDENTIQUES sur les 2 graphes) */}
          {scenarioConfig.map(({ key, label, color }) => {
            const scenario = scenarios[key];
            // Number.isFinite : scénario INDISPONIBLE (w/cg null) non tracé —
            // isNaN(null)===false laisserait passer un point fantôme → crash .toFixed.
            if (!scenario || !Number.isFinite(scenario.cg) || !Number.isFinite(scenario.w)) return null;

            const x = toX(xOf(scenario.w, scenario.cg));
            const y = toSvgY(scenario.w);
            const isInLimits = isPointWithinEnvelope(scenario.w, scenario.cg);

            const labelOffset = 110;
            const verticalOffset = 60;
            let labelX, labelY;
            switch (key) {
              case 'fulltank': labelX = x + labelOffset + 30; labelY = y - verticalOffset; break;
              case 'toCrm': labelX = x - labelOffset - 30; labelY = y - verticalOffset; break;
              case 'landing': labelX = x - labelOffset - 30; labelY = y + verticalOffset + 10; break;
              case 'zfw': labelX = x + labelOffset + 30; labelY = y + verticalOffset + 10; break;
              default: labelX = x + (x > 300 ? labelOffset : -labelOffset); labelY = y - verticalOffset;
            }
            if (labelX < 100) labelX = 100;
            if (labelX > 500) labelX = 500;
            if (labelY < 70) labelY = 70;
            if (labelY > 370) labelY = 370;

            return (
              <g key={key}>
                <line x1={x} y1={y} x2={labelX} y2={labelY} stroke={isInLimits ? color : 'var(--color-red-critical)'} strokeWidth="1" opacity="0.5" />
                {!isInLimits && (
                  <circle cx={x} cy={y} r="9" fill="none" stroke="var(--color-red-critical)" strokeWidth="2" strokeDasharray="3,2">
                    <animate attributeName="r" values="9;12;9" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r="5" fill={isInLimits ? color : 'var(--color-red-critical)'} fillOpacity="0.8" stroke={isInLimits ? color : 'var(--color-red-critical)'} strokeWidth="2" />
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect x="-60" y="-20" width="120" height={isInLimits ? '48' : '56'} fill="var(--bg-overlay)" fillOpacity="0.95" stroke={isInLimits ? color : 'var(--color-red-critical)'} strokeWidth={isInLimits ? '1.5' : '2'} rx="4" />
                  <text textAnchor="middle" fontSize="9" fill={isInLimits ? color : 'var(--color-red-critical)'} fontWeight="700">
                    <tspan x="0" y="-8">{label}</tspan>
                  </text>
                  <text textAnchor="middle" fontSize="7.5" fill="var(--text-secondary)" fontWeight="500">
                    <tspan x="0" y="2">Masse: {scenario.w.toFixed(3)} kg</tspan>
                    <tspan x="0" y="11">Moment: {(scenario.w * scenario.cg).toFixed(3)} kg.m</tspan>
                    <tspan x="0" y="20">CG: {scenario.cg.toFixed(3)} m ({(scenario.cg * 1000).toFixed(0)} mm)</tspan>
                  </text>
                  {!isInLimits && (
                    <text x="0" y="32" textAnchor="middle" fontSize="7" fill="var(--color-red-critical)" fontWeight="700">HORS LIMITES</text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Titre du graphe */}
          <text x="300" y="25" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)">{title}</text>
          <text x="300" y="40" textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">
            {aircraft.registration} - {aircraft.model}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div style={sx.spacing.mt(8)}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        Enveloppe de centrage — double vérification
      </h3>

      <div
        className="weight-balance-alert"
        style={{
          ...sx.combine(
            sx.components.alert.base,
            criticalScenariosWithinLimits
              ? (hasNonCriticalWarnings ? sx.components.alert.warning : sx.components.alert.success)
              : sx.components.alert.danger,
            sx.spacing.mb(4)
          ),
          display: 'none'
        }}
      >
        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
          {criticalScenariosWithinLimits
            ? (hasNonCriticalWarnings
                ? 'Scénarios critiques OK - Avertissements non-bloquants'
                : 'Tous les scénarios dans les limites')
            : 'Un ou plusieurs scénarios critiques hors limites'}
        </p>
      </div>

      {/* ─── Banc de cas de référence M&C : verdict d'écart chiffré (CG
          attendu vs calculé ± tolérance) + interrupteur du tracé. Le cas AUTO
          de la fiche de pesée est toujours listé — « non évaluable » explicite
          si la pesée est incomplète (fail-closed, jamais un verdict muet). */}
      {storedRefCases.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={showRefCases}
              onChange={(e) => setShowRefCases(e.target.checked)}
            />
            <span style={sx.text.sm}>
              Cas de référence M&C ({refCases.length}) — un point par bras de levier sur le graphique
            </span>
          </label>
          <div style={{ marginTop: tokens.spacing[2], display: 'flex', flexDirection: 'column', gap: tokens.spacing[1] }}>
            {refCases.map((c, ci) => {
              const color = WB_REF_COLORS[ci % WB_REF_COLORS.length];
              const badge = c.status === 'pass'
                ? { text: '✓ PASS', color }
                : c.status === 'fail'
                  ? { text: '✗ FAIL', color: 'var(--color-red-critical)' }
                  : { text: '⚠ NON ÉVALUABLE', color: 'var(--scenario-landing)' };
              return (
                <div key={`bench-${c.id}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: tokens.spacing[2] }}>
                  <span style={{ color: badge.color, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{badge.text}</span>
                  <span style={{ color, fontWeight: 600, fontSize: '0.85rem' }}>{c.label}</span>
                  {c.source && <span style={sx.combine(sx.text.xs, sx.text.secondary)}>({c.source})</span>}
                  {c.status === 'error' ? (
                    <span style={sx.combine(sx.text.xs, sx.text.secondary)}>{c.message}</span>
                  ) : (
                    <span style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      CG attendu {(c.cgExpected * 1000).toFixed(1)} mm · CG calculé {(c.cgComputed * 1000).toFixed(1)} mm
                      {' · '}écart {c.deviationMm.toFixed(1)} mm (tolérance ±{c.toleranceMm} mm)
                      {c.isWithinLimits === false && (
                        <span style={{ color: 'var(--color-red-critical)', fontWeight: 700 }}> · hors limites M&C</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={sx.combine(sx.components.card.base)}>
        {/* Graphe 1 — base CG */}
        {renderDiagram({
          chartKey: 'cg',
          title: 'Masse & Centrage — base CG',
          xAxisLabel: 'Centre de Gravité (mm)',
          xUnit: 'mm',
          xMin: scales.cgMin,
          xMax: scales.cgMax,
          toX: (raw) => 50 + (raw - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500,
          xOf: (w, cg) => cg * 1000,
          xFormat: (v) => Math.round(v)
        })}

        {/* Graphe 2 — base Moment (= masse × CG) */}
        {renderDiagram({
          chartKey: 'moment',
          title: 'Masse & Centrage — base Moment',
          xAxisLabel: 'Moment (kg.m)',
          xUnit: 'kg.m',
          xMin: momentScale.min,
          xMax: momentScale.max,
          toX: (raw) => 50 + (raw - momentScale.min) / (momentScale.max - momentScale.min) * 500,
          xOf: (w, cg) => w * cg,
          xFormat: (v) => Math.round(v)
        })}
      </div>
    </div>
  );
});

WeightBalanceChart.displayName = 'WeightBalanceChart';
