import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GraphConfig } from '../core/types';
import {
  performCascadeCalculation,
  performCascadeCalculationWithParameters,
  findGraphChain,
  validateGraphChain,
  CascadeResult,
  CascadeStep,
  GraphParameters
} from '../core/cascade';
import { ensureFittedGraphs } from '../core/fittedRuntime';
import { DEFAULT_TOLERANCE_PCT } from '../core/referenceBench';
import { Chart } from './Chart';
import { getAxisVariable, getAxisVariableLabel } from '../core/axisVariables';

// ─── Lot 1-F : LE TESTEUR UNIFIÉ — état de formulaire HISSÉ ─────────────────
// Les deux montages du testeur (écran Tracé replié / écran Validation ouvert)
// ne partageaient AUCUN état : tout se re-tapait à chaque changement d'étape.
// L'état de saisie vit désormais dans AbacBuilder (testDraft) et arrive ici en
// props contrôlées : les deux montages sont le MÊME formulaire à deux endroits,
// et le brouillon suit la session (abacSessionRef) + l'instantané IndexedDB.
export interface CascadeTestDraft {
  /** Valeur d'entrée initiale (texte brut du champ). */
  inputValue: string;
  /** Paramètre par graphe (texte brut), clé = graph.id. */
  parameters: { [graphId: string]: string };
  /** Direction du vent ('all' = pas encore choisie). */
  windDirection: 'headwind' | 'tailwind' | 'all';
  /** Valeur attendue du papier (texte brut, optionnelle). */
  expectedValue: string;
  /** Système d'abaques sélectionné (id du graphe de départ, '' = défaut). */
  selectedSystemId: string;
}

export function makeEmptyCascadeTestDraft(): CascadeTestDraft {
  return { inputValue: '', parameters: {}, windDirection: 'all', expectedValue: '', selectedSystemId: '' };
}

interface CascadeCalculatorProps {
  graphs: GraphConfig[];
  systems?: {
    graphs: GraphConfig[];
    metadata: any;
    name: string;
  }[];
  onClose?: () => void;
  /** Lot 1-F — état de formulaire hissé (contrôlé par AbacBuilder). Absent :
   *  repli sur un état local (montage autonome). */
  draft?: CascadeTestDraft;
  onDraftChange?: (next: CascadeTestDraft) => void;
  /** R13 — banc de test : propose les ENTRÉES du calcul courant comme futur
   *  cas de référence (le pilote tape ensuite le résultat ATTENDU du papier). */
  onProposeReference?: (snapshot: {
    inputValue: number;
    parameters: Record<string, number>;
    windDirection?: 'headwind' | 'tailwind';
    computed: number;
    /** R19 — attendu papier saisi pour la comparaison live, repris tel quel. */
    expected?: number;
  }) => void;
}

// ─── R10 : comparatif d'unités — la valeur finale est SYSTÉMATIQUEMENT doublée
// de l'unité « opposée » entre parenthèses (ft → m, m → ft, kt → km/h…) pour
// garder un ordre de grandeur de contrôle pendant le test (demande pilote).
// Lookup insensible à la casse (les anciens modèles stockent « ft »/« FT »).
const OPPOSITE_UNITS: Record<string, { to: string; factor: number }> = {
  'ft': { to: 'm', factor: 0.3048 },
  'm': { to: 'ft', factor: 1 / 0.3048 },
  'km': { to: 'NM', factor: 1 / 1.852 },
  'nm': { to: 'km', factor: 1.852 },
  'kt': { to: 'km/h', factor: 1.852 },
  'km/h': { to: 'kt', factor: 1 / 1.852 },
  'ft/min': { to: 'm/s', factor: 0.00508 },
  'm/s': { to: 'ft/min', factor: 1 / 0.00508 },
  'kg': { to: 'lb', factor: 2.20462262 },
  'lb': { to: 'kg', factor: 0.45359237 },
  'l': { to: 'gal', factor: 1 / 3.78541 },
  'gal': { to: 'L', factor: 3.78541 }
};

export function formatOppositeUnit(value: number, unit: string | undefined | null): string | null {
  if (!unit || !isFinite(value)) return null;
  const conv = OPPOSITE_UNITS[unit.trim().toLowerCase()];
  if (!conv) return null;
  const v = value * conv.factor;
  const decimals = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${v.toFixed(decimals)} ${conv.to}`;
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    // R10 — plus de maxWidth 800 : les étapes du calcul se posent CÔTE À CÔTE
    // (3 cadres ≈ 1 260 px) pour suivre le tracé comme sur l'abaque papier.
    width: '100%',
    margin: '0 auto'
  },
  header: {
    marginBottom: '20px',
    borderBottom: '2px solid var(--bg-overlay)',
    paddingBottom: '10px'
  },
  title: {
    fontSize: 'var(--fs-title)',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  inputSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '5px'
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    fontSize: 'var(--fs-body)',
    backgroundColor: 'var(--bg-overlay)'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    fontSize: 'var(--fs-body)'
  },
  chainDisplay: {
    padding: '10px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: 'var(--fs-body)'
  },
  // (calculateButton supprimé — Lot 1-F : le calcul est LIVE, débouncé à la
  //  frappe ; le bouton « Calculer » n'existe plus.)
  resultsSection: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px'
  },
  stepCard: {
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid var(--bg-overlay)'
  },
  stepNumber: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    textAlign: 'center' as const,
    lineHeight: '24px',
    fontSize: 'var(--fs-body)',
    fontWeight: 'bold',
    marginRight: '10px'
  },
  stepName: {
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '8px'
  },
  stepDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '8px',
    paddingLeft: '34px'
  },
  detailItem: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)'
  },
  detailValue: {
    fontWeight: 500,
    color: 'var(--text-primary)'
  },
  finalResult: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    borderRadius: '6px',
    textAlign: 'center' as const
  },
  finalValue: {
    fontSize: 'var(--fs-title)',
    fontWeight: 'bold',
    marginTop: '5px'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: 'var(--status-error-bg)',
    border: '1px solid var(--status-error-bg)',
    borderRadius: '4px',
    color: 'var(--color-red-critical)',
    fontSize: 'var(--fs-body)',
    marginTop: '10px'
  },
  validationWarning: {
    padding: '10px',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent-soft)',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: 'var(--fs-body)',
    color: 'var(--accent-primary)'
  }
};

export const CascadeCalculator: React.FC<CascadeCalculatorProps> = ({
  graphs,
  systems,
  onClose,
  draft: draftProp,
  onDraftChange,
  onProposeReference
}) => {
  // Lot 1-F — formulaire CONTRÔLÉ par AbacBuilder (testDraft hissé), avec
  // repli local pour un montage autonome. Champs : valeur d'entrée, paramètre
  // par graphe, direction du vent, attendu papier (R19), système sélectionné.
  const [localDraft, setLocalDraft] = useState<CascadeTestDraft>(makeEmptyCascadeTestDraft);
  const draft = draftProp ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const patchDraft = (patch: Partial<CascadeTestDraft>) => setDraft({ ...draft, ...patch });

  const [result, setResult] = useState<CascadeResult | null>(null);
  // Boîte ROUGE réservée aux REFUS DU MOTEUR (hors domaine, guide non
  // monotone…) ; les saisies incomplètes vont dans incompleteNote (discret).
  const [error, setError] = useState<string>('');
  const [incompleteNote, setIncompleteNote] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parameterWarnings, setParameterWarnings] = useState<{[graphId: string]: string}>({});
  // Retour visuel du « 📌 » — remis à zéro dès que les entrées changent.
  const [referencePinned, setReferencePinned] = useState(false);

  useEffect(() => {
    setReferencePinned(false);
  }, [draft]);

  // R20/Lot 1-F — les courbes en cours de tracé n'ont pas toujours leur
  // `fitted` (invalidé à chaque retouche de point, régénéré à la validation) :
  // on le régénère ICI aussi, pour que le testeur voie les graphes calculables
  // PENDANT le tracé. Pur, idempotent, identité préservée si rien à faire.
  const fittedGraphs = useMemo(() => ensureFittedGraphs(graphs), [graphs]);

  // Trouver tous les systèmes disponibles avec leurs métadonnées
  const availableSystems = useMemo(() => {
    // Si on a des systèmes avec métadonnées, les utiliser
    if (systems && systems.length > 0) {
      return systems.map(system => {
        const firstGraph = system.graphs[0];
        if (firstGraph) {
          return {
            ...firstGraph,
            systemName: system.name || system.metadata?.systemName || firstGraph.name,
            chainLength: system.graphs.length,
            metadata: system.metadata
          };
        }
        return null;
      }).filter(s => s !== null);
    }

    // Sinon : racines de chaîne = graphes sans amont. Lot 1-F — un graphe
    // ISOLÉ (ni amont ni aval : non cadré dans l'atelier) n'est PAS un
    // « système » quand une vraie chaîne existe — fini les fantômes du menu.
    const roots = fittedGraphs.filter(g => !g.linkedFrom || g.linkedFrom.length === 0);
    const chained = roots.filter(g => g.linkedTo && g.linkedTo.length > 0);
    const startGraphs = chained.length > 0 ? chained : roots;
    return startGraphs.map(startGraph => {
      const chain = findGraphChain(fittedGraphs, startGraph.id);
      let systemName = '';

      if (chain.length > 1) {
        const lastGraph = chain[chain.length - 1];
        systemName = `Système ${startGraph.name} → ${lastGraph.name}`;
      } else {
        systemName = `Système ${startGraph.name}`;
      }

      return {
        ...startGraph,
        systemName: systemName,
        chainLength: chain.length
      };
    });
  }, [fittedGraphs, systems]);

  // Utiliser le système sélectionné ou le premier par défaut (id périmé —
  // graphe supprimé — : repli silencieux sur le premier système).
  const startGraph = useMemo(() => {
    if (draft.selectedSystemId) {
      const g = fittedGraphs.find(g => g.id === draft.selectedSystemId);
      if (g) return g;
    }
    return availableSystems.length > 0 ? availableSystems[0] : null;
  }, [fittedGraphs, draft.selectedSystemId, availableSystems]);

  // Construire automatiquement la chaîne complète de graphiques
  const graphChain = useMemo(() => {
    if (!startGraph) return [];
    return findGraphChain(fittedGraphs, startGraph.id);
  }, [fittedGraphs, startGraph]);

  // Valider la chaîne
  const chainValidation = useMemo(() => {
    if (graphChain.length === 0) return { valid: true, errors: [] };
    return validateGraphChain(graphChain);
  }, [graphChain]);

  // ─── Lot 1-F : CASCADE PARTIELLE — le plus long PRÉFIXE calculable ────────
  // Fini le verrou « chaîne entière ou rien » : on calcule jusqu'au dernier
  // graphe COMPLET (axes + courbes interpolées — validateGraphChain rejoué sur
  // des préfixes décroissants). Le pilote valide chaque panneau contre le
  // papier AVANT de tracer la zone suivante.
  const evaluableChain = useMemo(() => {
    for (let n = graphChain.length; n >= 1; n--) {
      if (validateGraphChain(graphChain.slice(0, n)).valid) {
        return graphChain.slice(0, n);
      }
    }
    return [] as GraphConfig[];
  }, [graphChain]);
  const isPartial = evaluableChain.length > 0 && evaluableChain.length < graphChain.length;

  // Lot 1-F — pré-remplissage CONSERVATEUR du paramètre VENT : défaut 0
  // (convention resolveWindComponent : direction indéterminée ⇒ composante
  // nulle, jamais un vent de face favorable). Seulement quand le champ n'a
  // JAMAIS été touché (clé absente) — l'effacer reste possible.
  useEffect(() => {
    const missing = graphChain.filter((g, i) => i > 0 && g.isWindRelated && draft.parameters[g.id] === undefined);
    if (missing.length === 0) return;
    const parameters = { ...draft.parameters };
    for (const g of missing) parameters[g.id] = '0';
    setDraft({ ...draft, parameters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphChain, draft]);

  // Fonction pour vérifier un paramètre et retourner un avertissement si nécessaire
  const checkParameterBounds = useCallback((graph: GraphConfig, value: number, isWindGraph: boolean = false) => {
    if (!graph.axes) return null;

    // Pour les graphiques de vent, utiliser la valeur absolue pour la vérification
    const checkValue = isWindGraph ? Math.abs(value) : value;

    const xMin = graph.axes.xAxis.min;
    const xMax = graph.axes.xAxis.max;
    const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';

    if (checkValue < xMin) {
      return `⚠️ ${checkValue}${unit} est en dessous de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    } else if (checkValue > xMax) {
      return `⚠️ ${checkValue}${unit} est au-dessus de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    }
    return null;
  }, []);

  // Gérer le changement de paramètre avec vérification en temps réel
  const handleParameterChange = (graphId: string, value: string) => {
    patchDraft({ parameters: { ...draft.parameters, [graphId]: value } });

    // Vérifier les bornes en temps réel
    const graph = graphChain.find(g => g.id === graphId);
    const graphIndex = graphChain.findIndex(g => g.id === graphId);

    if (graph && value !== '') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        // Ne pas vérifier les bornes pour le premier graphique (famille :
        // paramètre d'interpolation entre les courbes, pas une entrée X), ni
        // en lecture descendante (paramètre = famille des guides, l'axe X
        // porte la SORTIE — ses bornes ne s'appliquent pas au paramètre).
        if (graphIndex === 0 || graph.readoutAxis === 'x') {
          setParameterWarnings(prev => ({
            ...prev,
            [graphId]: ''
          }));
        } else {
          // Pour les autres graphiques, vérifier les bornes
          // Passer isWindGraph=true si le graphique est lié au vent
          const warning = checkParameterBounds(graph, numValue, graph.isWindRelated);
          setParameterWarnings(prev => ({
            ...prev,
            [graphId]: warning || ''
          }));
        }
      } else {
        setParameterWarnings(prev => ({
          ...prev,
          [graphId]: ''
        }));
      }
    } else {
      setParameterWarnings(prev => ({
        ...prev,
        [graphId]: ''
      }));
    }
  };

  // ─── Lot 1-F : CALCUL LIVE — le résultat (et le badge d'écart papier) se
  // recalcule à la frappe, débouncé ~300 ms, dès que les entrées requises du
  // PRÉFIXE calculable sont valides. Plus de bouton « Calculer ». Saisie
  // incomplète → note discrète (incompleteNote) ; refus moteur → boîte rouge.
  const runLiveCalculation = useCallback(() => {
    if (evaluableChain.length === 0 || draft.inputValue.trim() === '') {
      setResult(null); setError(''); setWarnings([]); setIncompleteNote('');
      return;
    }

    const value = parseFloat(draft.inputValue);
    if (isNaN(value)) {
      setResult(null); setError(''); setWarnings([]);
      setIncompleteNote('Valeur d\'entrée non numérique.');
      return;
    }

    // R11 — un set qui contient des courbes vent de face ET vent arrière ne
    // se calcule JAMAIS sans direction explicite : interpoler entre les deux
    // familles est physiquement absurde (test de référence PA-28 : 2968 ft au
    // lieu de 1900 avec le sélecteur resté sur « toutes »). Le moteur a la
    // même garde — ici c'est une SAISIE INCOMPLÈTE (le sélecteur est à
    // l'écran), pas un refus moteur.
    if (draft.windDirection === 'all') {
      const mixedWindGraph = evaluableChain.find(g => {
        if (!g.isWindRelated) return false;
        // Lecture descendante : les guides face + nul + arrière coexistent par
        // construction — le paramètre SIGNÉ choisit le guide, pas de direction.
        if (g.readoutAxis === 'x') return false;
        const fams = new Set(
          g.curves
            .map(c => c.windDirection && c.windDirection !== 'none'
              ? c.windDirection
              : (c.name.toLowerCase().includes('headwind') ? 'headwind'
                : c.name.toLowerCase().includes('tailwind') ? 'tailwind' : null))
            .filter(Boolean)
        );
        return fams.size > 1;
      });
      if (mixedWindGraph) {
        setResult(null); setError(''); setWarnings([]);
        setIncompleteNote(`Choisis la direction du vent : « ${mixedWindGraph.name} » contient des courbes vent de face ET vent arrière.`);
        return;
      }
    }

    // Préparer les paramètres pour les graphiques du PRÉFIXE calculable
    // (y compris le premier pour la famille — ex. altitude pression).
    const graphParameters: GraphParameters[] = [];
    const warningsList: string[] = [];
    const missingLabels: string[] = [];

    for (let i = 0; i < evaluableChain.length; i++) {
      const graph = evaluableChain[i];
      const paramValue = parseFloat(draft.parameters[graph.id] || '');

      // Le paramètre est obligatoire pour tous les graphiques
      if (i === 0) {
        // Premier graphique : la FAMILLE des courbes (Lot 1-F — fini le
        // « Altitude pression » codé en dur : un abaque à famille masse dit
        // « Masse », via getAxisVariableLabel(graph.familyAxisVariable)).
        const famLabel = getAxisVariableLabel(graph.familyAxisVariable) || 'Paramètre du premier graphique';
        if (isNaN(paramValue)) {
          missingLabels.push(`${famLabel} (${graph.name})`);
          continue;
        }

        // NE PAS vérifier les bornes : c'est un paramètre d'interpolation
        // entre les courbes disponibles (ex: entre 2000 ft et 4000 ft).

        graphParameters.push({
          graphId: graph.id,
          parameter: paramValue,
          parameterName: famLabel
        });
      } else if (graph.readoutAxis === 'x') {
        // Lecture descendante : le paramètre est la valeur de FAMILLE des
        // guides (ex. vent signé) — l'axe X porte la sortie, ses bornes ne
        // s'appliquent pas au paramètre ; hors des guides, le moteur refuse.
        if (isNaN(paramValue)) {
          missingLabels.push(`${getAxisVariableLabel(graph.familyAxisVariable) || 'valeur de famille des guides'} (${graph.name})`);
          continue;
        }
        graphParameters.push({
          graphId: graph.id,
          parameter: paramValue,
          parameterName: graph.familyAxisVariable || 'famille'
        });
      } else {
        // Graphiques suivants : paramètre obligatoire
        if (isNaN(paramValue)) {
          missingLabels.push(`${getAxisVariableLabel(graph.axes?.xAxis.title) || 'paramètre'} (${graph.name})`);
          continue;
        }

        // Vérifier si le paramètre est dans les bornes définies du graphique
        if (graph.axes) {
          const xMin = graph.axes.xAxis.min;
          const xMax = graph.axes.xAxis.max;

          if (paramValue < xMin || paramValue > xMax) {
            const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';
            warningsList.push(
              `⚠️ ${graph.axes.xAxis.title}: ${paramValue}${unit} est hors plage réglementaire [${xMin}${unit} - ${xMax}${unit}]. Résultat extrapolé.`
            );
          }
        }

        // Passer la direction du vent dans les paramètres si c'est un graphique de vent
        const graphWindDirection = graph.isWindRelated && draft.windDirection !== 'all' ? draft.windDirection : undefined;

        graphParameters.push({
          graphId: graph.id,
          parameter: paramValue,
          parameterName: graph.axes?.xAxis.title,
          windDirection: graphWindDirection
        });
      }
    }

    if (missingLabels.length > 0) {
      setResult(null); setError(''); setWarnings([]);
      setIncompleteNote(`Saisie incomplète — ${missingLabels.join(' · ')}.`);
      return;
    }

    const calcResult = performCascadeCalculationWithParameters(evaluableChain, value, graphParameters);

    setIncompleteNote('');
    setWarnings(warningsList);

    if (!calcResult.success) {
      setResult(null);
      setError(calcResult.error || 'Erreur lors du calcul');
      return;
    }

    setError('');
    setResult(calcResult);
  }, [draft, evaluableChain]);

  useEffect(() => {
    const t = window.setTimeout(runLiveCalculation, 300);
    return () => window.clearTimeout(t);
  }, [runLiveCalculation]);

  const renderStep = (step: CascadeStep, index: number) => {
    // Trouver le graphique correspondant (les étapes viennent du PRÉFIXE
    // calculable — identique à graphChain sur ses index).
    const graph = evaluableChain[index];

    return (
    // R10 — chaque étape est une CARTE de largeur fixe : les mini-graphiques se
    // posent côte à côte (gauche → droite, comme la lecture de l'abaque papier)
    // pour suivre le tracé d'un graphe au suivant.
    <div key={step.graphId} style={{ ...styles.stepCard, margin: 0, flex: '0 0 auto', width: 396, maxWidth: '100%', border: '1px solid var(--border-subtle)' }}>
      <div style={styles.stepName}>
        <span style={styles.stepNumber}>{index + 1}</span>
        {step.graphName}
      </div>

      {/* Mini graphique avec visualisation CORRECTE des abaques */}
      {graph && graph.axes && (
        <div style={{
          marginTop: '15px',
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: 'var(--bg-overlay)',
          borderRadius: '4px',
          position: 'relative'
        }}>
          <Chart
            axesConfig={graph.axes}
            curves={(() => {
              // Filtrer et colorer les courbes selon leur utilisation
              if (step.referenceCurves) {
                // Si on a des courbes de référence, les mettre en évidence
                return graph.curves.map(c => {
                  const isLower = c.name === step.referenceCurves.lowerCurveName;
                  const isUpper = c.name === step.referenceCurves.upperCurveName;
                  if (isLower) return { ...c, color: 'var(--accent-primary)' }; // Vert pour courbe inférieure
                  if (isUpper) return { ...c, color: 'var(--accent-primary)' }; // Bleu pour courbe supérieure
                  return { ...c, color: 'var(--border-subtle)' }; // Gris pour les autres
                });
              } else if (step.curveUsed) {
                // Sinon, utiliser l'ancienne méthode
                return graph.curves.map(c => {
                  const isUsed = c.name === step.curveUsed || step.curveUsed.includes(c.name);
                  return { ...c, color: isUsed ? 'var(--color-red-critical)' : 'var(--border-subtle)' };
                });
              }
              return graph.curves;
            })()}
            selectedCurveId={null}
            width={350}
            height={250}
            showLegend={false}
            showGrid={true}
          />

          {/* Overlay SVG pour les annotations du processus d'abaques */}
          <svg
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              pointerEvents: 'none'
            }}
            width="350"
            height="250"
          >
            <g transform="translate(40, 30)">
              {(() => {
                // Créer les mêmes fonctions de scaling que Chart.tsx
                const innerWidth = 270;
                const innerHeight = 190;

                // Fonction de scaling X
                // (les blocs « Debug … masse » mutilés par une ancienne passe de
                //  suppression de console.log — têtes d'appels retirées, queues de
                //  template literals laissées — ont été purgés ici : le fichier ne
                //  compilait plus dès qu'on l'importait réellement.)
                const xScale = (value: number) => {
                  const ratio = (value - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min);
                  return graph.axes.xAxis.reversed ? innerWidth * (1 - ratio) : innerWidth * ratio;
                };

                // Fonction de scaling Y (inversé pour SVG)
                const yScale = (value: number) => {
                  const ratio = (value - graph.axes.yAxis.min) / (graph.axes.yAxis.max - graph.axes.yAxis.min);
                  return graph.axes.yAxis.reversed ? innerHeight * ratio : innerHeight * (1 - ratio);
                };

                return (
                  <>
              {/* Pour le premier graphique (température) */}
              {index === 0 && (
                <>
                  {/* Ligne verticale d'entrée X */}
                  <line
                    x1={xScale(step.inputValue)}
                    y1="0"
                    x2={xScale(step.inputValue)}
                    y2={innerHeight}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <text
                    x={xScale(step.inputValue) - 10}
                    y={innerHeight + 15}
                    fontSize="10"
                    fill="var(--accent-primary)"
                  >
                    X={step.inputValue.toFixed(0)}
                  </text>

                  {/* Si paramètre de famille fourni, montrer les courbes d'interpolation */}
                  {step.parameter !== undefined && step.referenceCurves && (
                    <>
                      {/* Indicateur de famille (Lot 1-F — plus de « Alt … ft »
                          en dur : symbole/label de la famille du graphe) */}
                      <text
                        x="5"
                        y="-10"
                        fontSize="11"
                        fill="var(--accent-primary)"
                        fontWeight="bold"
                      >
                        {getAxisVariable(graph.familyAxisVariable)?.symbol || getAxisVariableLabel(graph.familyAxisVariable) || 'Fam'}: {step.parameter.toFixed(0)}{(() => {
                          const u = getAxisVariable(graph.familyAxisVariable)?.defaultUnit;
                          return u ? ` ${u}` : '';
                        })()}
                      </text>

                      {/* Point de sortie interpolé */}
                      <circle
                        cx={xScale(step.inputValue)}
                        cy={yScale(step.outputValue)}
                        r="6"
                        fill="var(--color-red-critical)"
                        stroke="white"
                        strokeWidth="2"
                      />

                      {/* Label de sortie */}
                      <text
                        x={xScale(step.inputValue) + 10}
                        y={yScale(step.outputValue) - 5}
                        fontSize="10"
                        fill="var(--color-red-critical)"
                        fontWeight="bold"
                      >
                        Y={step.outputValue.toFixed(0)}
                      </text>
                    </>
                  )}

                  {/* Sans altitude, point direct */}
                  {step.parameter === undefined && (
                    <circle
                      cx={xScale(step.inputValue)}
                      cy={yScale(step.outputValue)}
                      r="6"
                      fill="var(--accent-primary)"
                      stroke="white"
                      strokeWidth="2"
                    />
                  )}
                </>
              )}

              {/* Lecture descendante (readoutAxis 'x', planches d'atterrissage) :
                  entrée Y → intersection avec le guide → DESCENTE verticale →
                  sortie lue en BAS sur l'axe X. Pas de « verticale du
                  paramètre » : le paramètre est la valeur de FAMILLE des guides
                  (vent signé), pas une position X. */}
              {index > 0 && graph.readoutAxis === 'x' && (
                <>
                  {/* ÉTAPE 1: Ligne horizontale d'entrée, arrêtée au point
                      d'intersection avec le guide (x = sortie) */}
                  <line
                    x1="0"
                    y1={yScale(step.inputValue)}
                    x2={xScale(step.outputValue)}
                    y2={yScale(step.inputValue)}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <text
                    x="-35"
                    y={yScale(step.inputValue) + 3}
                    fontSize="10"
                    fill="var(--accent-primary)"
                  >
                    Y={step.inputValue.toFixed(0)}
                  </text>

                  {/* ÉTAPE 2: Descente verticale depuis l'intersection
                      jusqu'au bas de la zone de tracé */}
                  <line
                    x1={xScale(step.outputValue)}
                    y1={yScale(step.inputValue)}
                    x2={xScale(step.outputValue)}
                    y2={innerHeight}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />

                  {/* ÉTAPE 3: Point de sortie rouge posé EN BAS, sur l'axe X */}
                  <circle
                    cx={xScale(step.outputValue)}
                    cy={innerHeight}
                    r="6"
                    fill="var(--color-red-critical)"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={xScale(step.outputValue) + 10}
                    y={innerHeight - 6}
                    fontSize="10"
                    fill="var(--color-red-critical)"
                    fontWeight="bold"
                  >
                    X={step.outputValue.toFixed(0)}
                  </text>
                </>
              )}

              {/* Pour les graphiques suivants (avec méthode des abaques) */}
              {index > 0 && graph.readoutAxis !== 'x' && (
                <>
                  {/* ÉTAPE 1: Ligne horizontale à Y=entrée */}
                  <line
                    x1="0"
                    y1={yScale(step.inputValue)}
                    x2={innerWidth}
                    y2={yScale(step.inputValue)}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <text
                    x="-35"
                    y={yScale(step.inputValue) + 3}
                    fontSize="10"
                    fill="var(--accent-primary)"
                  >
                    Y={step.inputValue.toFixed(0)}
                  </text>

                  {/* ÉTAPE 2: Ligne verticale au paramètre X */}
                  {step.parameter !== undefined && (
                    <>
                      <line
                        x1={xScale(step.parameter)}
                        y1="0"
                        x2={xScale(step.parameter)}
                        y2={innerHeight}
                        stroke="var(--accent-primary)"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        opacity="0.7"
                      />
                      <text
                        x={xScale(step.parameter) - 10}
                        y={innerHeight + 15}
                        fontSize="10"
                        fill="var(--accent-primary)"
                      >
                        X={step.parameter.toFixed(0)}
                      </text>

                      {/* ÉTAPE 3: Points aux intersections des courbes de référence */}
                      {step.valuesAtCrossing && (
                        <>
                          {/* Point sur la courbe inférieure */}
                          {step.valuesAtCrossing.lowerValue !== undefined && (
                            <circle
                              cx={xScale(step.parameter)}
                              cy={yScale(step.valuesAtCrossing.lowerValue)}
                              r="4"
                              fill="var(--accent-primary)"
                              stroke="white"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Point sur la courbe supérieure */}
                          {step.valuesAtCrossing.upperValue !== undefined && (
                            <circle
                              cx={xScale(step.parameter)}
                              cy={yScale(step.valuesAtCrossing.upperValue)}
                              r="4"
                              fill="var(--accent-primary)"
                              stroke="white"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Ligne reliant les deux points (zone d'interpolation) */}
                          {step.valuesAtCrossing.lowerValue !== undefined && step.valuesAtCrossing.upperValue !== undefined && (
                            <line
                              x1={xScale(step.parameter)}
                              y1={yScale(step.valuesAtCrossing.lowerValue)}
                              x2={xScale(step.parameter)}
                              y2={yScale(step.valuesAtCrossing.upperValue)}
                              stroke="var(--accent-primary)"
                              strokeWidth="3"
                              opacity="0.3"
                            />
                          )}
                        </>
                      )}

                      {/* ÉTAPE 4: Point de sortie interpolé */}
                      <circle
                        cx={xScale(step.parameter)}
                        cy={yScale(step.outputValue)}
                        r="6"
                        fill="var(--color-red-critical)"
                        stroke="white"
                        strokeWidth="2"
                      />

                      {/* Flèche et label de sortie */}
                      <g transform={`translate(${xScale(step.parameter) + 15}, ${yScale(step.outputValue)})`}>
                        <path
                          d="M 0,0 L 10,-3 L 10,3 Z"
                          fill="var(--color-red-critical)"
                        />
                        <text
                          x="15"
                          y="3"
                          fontSize="10"
                          fill="var(--color-red-critical)"
                          fontWeight="bold"
                        >
                          Y={step.outputValue.toFixed(0)}
                        </text>
                      </g>
                    </>
                  )}
                </>
              )}
                  </>
                );
              })()}
            </g>
          </svg>
        </div>
      )}

      <div style={styles.stepDetails}>
        {index === 0 ? (
          // Premier graphique : entrée sur X avec paramètre de famille optionnel
          <>
            <div style={styles.detailItem}>
              Entrée (X):
              <span style={styles.detailValue}> {step.inputValue.toFixed(2)}</span>
            </div>
            {step.parameter !== undefined && (
              <div style={styles.detailItem}>
                {/* Lot 1-F — libellé de FAMILLE (plus de « Altitude pression … ft » en dur) */}
                {step.parameterName || getAxisVariableLabel(graph?.familyAxisVariable) || 'Paramètre'}:
                <span style={styles.detailValue}> {step.parameter.toFixed(0)}{(() => {
                  const u = getAxisVariable(graph?.familyAxisVariable)?.defaultUnit;
                  return u ? ` ${u}` : '';
                })()}</span>
              </div>
            )}
          </>
        ) : (
          // Graphiques suivants : entrée sur Y avec paramètre sur X
          <>
            <div style={styles.detailItem}>
              Entrée (Y):
              <span style={styles.detailValue}> {step.inputValue.toFixed(2)}</span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', marginLeft: '4px' }}>
                (valeur précédente)
              </span>
            </div>
            {step.parameter !== undefined && (
              <div style={styles.detailItem}>
                Paramètre ({step.parameterName || 'X'}):
                <span style={styles.detailValue}> {step.parameter.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
        <div style={styles.detailItem}>
          {graph?.readoutAxis === 'x' ? 'Sortie (X, lue en bas):' : 'Sortie (Y):'}
          <span style={styles.detailValue}> {step.outputValue.toFixed(2)}</span>
          {graph?.readoutAxis === 'x' && graph?.axes?.xAxis?.unit && (
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginLeft: '4px' }}>
              {graph.axes.xAxis.unit}
            </span>
          )}
        </div>
        {step.curveUsed && (
          <div style={styles.detailItem}>
            Courbe: <span style={styles.detailValue}>{step.curveUsed}</span>
          </div>
        )}
      </div>

      {/* Lot 1-F — DÉGRAISSAGE : la grille textuelle répétait les nombres du
          SVG (position entre courbes, croisements verticaux, formule
          d'interpolation) — repliée ici, à la demande. « Trajectoire » (jargon
          offset moteur) et le warning permanent « ⚠ Valeur interpolée »
          (l'interpolation est le cas NORMAL) sont supprimés. */}
      {(step.referenceCurves || step.valuesAtCrossing) && (
        <details style={{ marginTop: 8, paddingLeft: 34 }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
            Détail du calcul
          </summary>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: 4, paddingLeft: 10 }}>
            {step.referenceCurves && (
              <div>
                Position entre courbes:
                <br />• {step.referenceCurves.lowerCurveName} (Y={step.referenceCurves.lowerYAtRef?.toFixed(2)})
                <br />• {step.referenceCurves.upperCurveName} (Y={step.referenceCurves.upperYAtRef?.toFixed(2)})
              </div>
            )}
            {step.valuesAtCrossing && (
              <div style={{ marginTop: 4 }}>
                <strong>Croisements verticaux à X={step.parameter?.toFixed(2)}:</strong>
                <div style={{ marginLeft: '10px', marginTop: '2px' }}>
                  • Courbe inférieure: Y={step.valuesAtCrossing.lowerValue?.toFixed(2) || 'N/A'}<br />
                  • Courbe supérieure: Y={step.valuesAtCrossing.upperValue?.toFixed(2) || 'N/A'}
                </div>
              </div>
            )}
            {step.interpolated && step.valuesAtCrossing && (
              <div style={{ marginTop: 4 }}>
                Interpolation: {step.valuesAtCrossing.lowerValue?.toFixed(2)} +
                {' '}{step.offset?.toFixed(2)} ×
                ({step.valuesAtCrossing.upperValue?.toFixed(2)} - {step.valuesAtCrossing.lowerValue?.toFixed(2)})
                = {step.outputValue.toFixed(2)}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔄 Calculateur en Cascade</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>
          Propagez une valeur à travers une chaîne de graphiques liés
        </p>
      </div>

      <div style={styles.inputSection}>
        {/* Sélecteur de système d'abaques — Lot 1-F : MASQUÉ quand une seule
            chaîne existe (cas nominal atelier image unique) : un menu à une
            option est du bruit. Les graphes isolés (non cadrés) ne comptent
            plus comme « systèmes » fantômes (cf. availableSystems). */}
        {availableSystems.length > 1 && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              📊 Sélectionnez le système d'abaques
            </label>
            <select
              style={styles.select}
              value={draft.selectedSystemId || (startGraph?.id || '')}
              onChange={(e) => patchDraft({ selectedSystemId: e.target.value })}
            >
              {availableSystems.map(system => (
                <option key={system.id} value={system.id}>
                  {system.systemName}
                  {system.chainLength > 1 && ` (${system.chainLength} étapes)`}
                </option>
              ))}
            </select>
            {startGraph && startGraph.axes && (
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Point de départ: {startGraph.axes.xAxis.title}
                {startGraph.axes.xAxis.unit && ` (${startGraph.axes.xAxis.unit})`}
              </div>
            )}
          </div>
        )}
        {availableSystems.length === 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--status-error-bg)',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid var(--color-red-critical)'
          }}>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)' }}>
              ⚠ Aucun système d'abaques configuré
            </div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Veuillez configurer vos graphiques dans l'étape 1
            </div>
          </div>
        )}

        {graphChain.length > 0 && (
          <div style={styles.chainDisplay}>
            <strong>Chaîne de calcul:</strong>
            <div style={{ marginTop: '5px' }}>
              {graphChain.map((g, i) => (
                // Lot 1-F — cascade partielle : les graphes AU-DELÀ du préfixe
                // calculable sont grisés (pas encore complets), pas bloquants.
                <span
                  key={g.id}
                  style={i < evaluableChain.length ? undefined : { opacity: 0.45 }}
                  title={i < evaluableChain.length ? undefined : 'Graphe incomplet (axes ou courbes interpolées manquantes) — pas encore évalué'}
                >
                  {i > 0 && ' → '}
                  <strong>{g.name}</strong>
                  {g.axes && (
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                      {' '}({g.readoutAxis === 'x'
                        ? `${g.axes.yAxis.title} → ${g.axes.xAxis.title} ↓`
                        : `${g.axes.xAxis.title} → ${g.axes.yAxis.title}`})
                    </span>
                  )}
                </span>
              ))}
            </div>
            {isPartial && (
              <div style={{ marginTop: 6, fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                Cascade partielle : le calcul s'arrête après « {evaluableChain[evaluableChain.length - 1].name} » —
                les graphes grisés ne sont pas encore complets (axes + courbes interpolées).
              </div>
            )}
          </div>
        )}

        {/* Lot 1-F — les problèmes de chaîne ne s'affichent que quand RIEN
            n'est calculable (sinon la cascade partielle prend le relais et la
            liste ferait doublon avec les graphes grisés ci-dessus). */}
        {evaluableChain.length === 0 && chainValidation.errors.length > 0 && (
          <div style={styles.validationWarning}>
            <strong>⚠ Problèmes détectés:</strong>
            <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
              {chainValidation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {startGraph && evaluableChain.length > 0 && (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Valeur d'entrée initiale
                {graphChain.length > 0 && graphChain[0].axes && (
                  // R16b — libellé HUMAIN + UNITÉ explicite (demande pilote :
                  // sans unité affichée, l'erreur de saisie est invisible).
                  <span style={{ fontWeight: 'normal' }}>
                    {' '}— {getAxisVariableLabel(graphChain[0].axes.xAxis.title)}
                    {graphChain[0].axes.xAxis.unit && (
                      <strong> ({graphChain[0].axes.xAxis.unit})</strong>
                    )}
                  </span>
                )}
              </label>
              <input
                type="number"
                style={styles.input}
                value={draft.inputValue}
                onChange={(e) => patchDraft({ inputValue: e.target.value })}
                placeholder="Entrez une valeur numérique"
              />
            </div>

            {/* Champs pour les paramètres de chaque graphique du PRÉFIXE
                calculable (Lot 1-F — cascade partielle : les graphes pas
                encore complets n'exigent rien) */}
            {evaluableChain.map((graph, index) => (
              <div key={graph.id} style={styles.inputGroup}>
                <label style={styles.label}>
                  {index === 0 ? (
                    <>
                      {/* Lot 1-F — fini « Altitude pression » codé en dur : le
                          paramètre du graphe 0 porte le libellé de SA famille
                          (getAxisVariableLabel) — un abaque à famille masse
                          dit « Masse ». R16b — l'unité de la famille reste
                          affichée explicitement (fini le « ft ou m » ambigu). */}
                      {(() => {
                        const fam = getAxisVariable(graph.familyAxisVariable);
                        if (fam) return <>{fam.label} pour {graph.name}{fam.defaultUnit && <strong> ({fam.defaultUnit})</strong>}</>;
                        const names = graph.curves.slice(0, 3).map(c => c.name).join(', ');
                        return <>Paramètre pour {graph.name} — même échelle que les courbes : <strong>{names}{graph.curves.length > 3 ? '…' : ''}</strong></>;
                      })()}
                      <span style={{ fontWeight: 'normal', color: 'var(--color-red-critical)' }}>
                        {' '}(obligatoire)
                      </span>
                    </>
                  ) : graph.readoutAxis === 'x' ? (
                    <>
                      Paramètre pour {graph.name}
                      <span style={{ fontWeight: 'normal' }}>
                        {' '}— {getAxisVariableLabel(graph.familyAxisVariable) || 'valeur de famille des guides'}
                        <strong> (signée : + vent de face, − vent arrière)</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      Paramètre pour {graph.name}
                      {graph.axes && (
                        <span style={{ fontWeight: 'normal' }}>
                          {' '}— {getAxisVariableLabel(graph.axes.xAxis.title)}
                          {graph.axes.xAxis.unit && (
                            <strong> ({graph.axes.xAxis.unit})</strong>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </label>
                <input
                  type="number"
                  style={{
                    ...styles.input,
                    borderColor: parameterWarnings[graph.id] ? 'var(--accent-primary)' : 'var(--border-subtle)'
                  }}
                  value={draft.parameters[graph.id] || ''}
                  onChange={(e) => handleParameterChange(graph.id, e.target.value)}
                  placeholder={
                    index === 0
                      ? 'Valeur sur l\'échelle des courbes du graphe'
                      : graph.readoutAxis === 'x'
                        ? 'Valeur signée (+ face, − arrière)'
                        : `Valeur en ${graph.axes?.xAxis.unit || '…'}`
                  }
                />
                {parameterWarnings[graph.id] && (
                  <div style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--accent-primary)',
                    marginTop: '4px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--accent-soft)',
                    borderRadius: '3px',
                    border: '1px solid var(--accent-soft)'
                  }}>
                    {parameterWarnings[graph.id]}
                  </div>
                )}
                {graph.curves && graph.curves.length > 0 && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {index === 0 ? 'Courbes de la famille : ' : 'Courbes disponibles: '}
                    {graph.curves.map(c => c.name).join(', ')}
                  </div>
                )}
              </div>
            ))}

            {/* Sélecteur de direction du vent pour les graphiques liés au vent
                (inutile en lecture descendante : le paramètre signé choisit le
                guide ; limité au préfixe calculable — Lot 1-F) */}
            {evaluableChain.some(g => g.isWindRelated && g.readoutAxis !== 'x') && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  💨 Direction du vent pour le calcul
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => patchDraft({ windDirection: 'headwind' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: draft.windDirection === 'headwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                      color: draft.windDirection === 'headwind' ? 'white' : 'var(--text-primary)',
                      border: '1px solid ' + (draft.windDirection === 'headwind' ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-body)',
                      fontWeight: draft.windDirection === 'headwind' ? 'bold' : 'normal'
                    }}
                  >
                    ⬅️ Vent de face
                  </button>
                  <button
                    onClick={() => patchDraft({ windDirection: 'tailwind' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: draft.windDirection === 'tailwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                      color: draft.windDirection === 'tailwind' ? 'white' : 'var(--text-primary)',
                      border: '1px solid ' + (draft.windDirection === 'tailwind' ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-body)',
                      fontWeight: draft.windDirection === 'tailwind' ? 'bold' : 'normal'
                    }}
                  >
                    ➡️ Vent arrière
                  </button>
                </div>
                {/* Lot 1-F — note DISCRÈTE (saisie incomplète, pas un refus
                    moteur : la boîte rouge est réservée au moteur). */}
                {draft.windDirection === 'all' && (
                  <div style={{ marginTop: 6, fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    Choisis la direction : le calcul ne mélange jamais vent de face et vent arrière.
                  </div>
                )}
                {draft.windDirection !== 'all' && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Seules les courbes {draft.windDirection === 'headwind' ? 'vent de face' : 'vent arrière'} seront utilisées
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* R19 — valeur attendue du PAPIER (optionnelle) : l'écart % s'affiche
            en live sur le résultat, pour corriger les courbes à vue. Le badge
            d'écart ne s'affiche que sur la CHAÎNE COMPLÈTE (Lot 1-F). */}
        {startGraph && evaluableChain.length > 0 && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              Valeur attendue du papier
              <span style={{ fontWeight: 'normal' }}>
                {' '}(optionnel{(() => {
                  const lg = graphChain[graphChain.length - 1];
                  // Lecture descendante : le résultat sort sur l'axe X.
                  const u = lg?.readoutAxis === 'x' ? lg?.axes?.xAxis?.unit : lg?.axes?.yAxis?.unit;
                  return u ? <> — <strong>{u}</strong></> : null;
                })()})
              </span>
            </label>
            <input
              type="number"
              style={styles.input}
              value={draft.expectedValue}
              onChange={(e) => patchDraft({ expectedValue: e.target.value })}
              placeholder="Résultat lu sur l'abaque du manuel de vol"
            />
          </div>
        )}

        {/* Lot 1-F — CALCUL LIVE : plus de bouton « Calculer ». La saisie
            incomplète s'affiche en note discrète (la boîte rouge plus bas est
            réservée aux refus du moteur : hors domaine, guide non monotone…). */}
        {incompleteNote && (
          <div style={{ marginTop: 8, fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
            {incompleteNote}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div style={styles.validationWarning}>
          {warnings.map((warning, index) => (
            <div key={index} style={{ marginBottom: index < warnings.length - 1 ? '8px' : 0 }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          ❌ {error}
        </div>
      )}

      {result && result.success && (
        <div style={styles.resultsSection}>
          <h3 style={{ fontSize: 'var(--fs-title)', marginBottom: '15px', color: 'var(--text-primary)' }}>
            📊 Résultats du calcul
          </h3>

          {/* R10 — les étapes se suivent CÔTE À CÔTE (flux gauche → droite avec
              flèches), comme le tracé sur l'abaque papier ; passage à la ligne
              automatique sur écran étroit. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
            {result.steps.map((step, index) => (
              <React.Fragment key={step.graphId}>
                {renderStep(step, index)}
                {index < result.steps.length - 1 && (
                  <div style={{ alignSelf: 'center', fontSize: 22, color: 'var(--accent-primary)', fontWeight: 700 }} aria-hidden="true">
                    →
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div style={styles.finalResult}>
            {/* Lot 1-F — cascade partielle : le résultat d'un PRÉFIXE est
                annoncé comme tel, avec le dernier graphe évalué. */}
            <div>
              {isPartial
                ? `Résultat partiel — jusqu'à « ${evaluableChain[evaluableChain.length - 1]?.name} »`
                : 'Valeur finale'}
            </div>
            {(() => {
              const lastGraph = evaluableChain.length > 0 ? evaluableChain[evaluableChain.length - 1] : undefined;
              const lastAxes = lastGraph?.axes;
              // Lecture descendante : le résultat sort sur l'axe X du dernier
              // graphe ÉVALUÉ (échelle des distances, en bas) — unité et titre
              // suivent ; le moteur renseigne outputUnit en priorité.
              const readoutX = lastGraph?.readoutAxis === 'x';
              const unit = result.outputUnit || (readoutX ? lastAxes?.xAxis?.unit : lastAxes?.yAxis?.unit) || '';
              // R10 — comparatif systématique dans l'unité opposée (ft ↔ m…)
              const opposite = formatOppositeUnit(result.finalValue, unit);
              return (
                <>
                  <div style={styles.finalValue}>
                    {result.finalValue.toFixed(2)}{unit ? ` ${unit}` : ''}
                    {opposite && (
                      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 500, marginLeft: 10, opacity: 0.95 }}>
                        ({opposite})
                      </span>
                    )}
                  </div>
                  {lastAxes && (
                    <div style={{ fontSize: 'var(--fs-body)', marginTop: '5px' }}>
                      {readoutX ? `${lastAxes.xAxis.title} (lu sur l'axe X)` : lastAxes.yAxis.title}
                    </div>
                  )}
                  {/* R19 — comparaison LIVE avec la valeur attendue du papier :
                      écart % signé, vert dans la tolérance du banc
                      (DEFAULT_TOLERANCE_PCT — source unique), rouge au-delà.
                      Lot 1-F : uniquement sur la CHAÎNE COMPLÈTE (un écart
                      contre un résultat partiel n'a pas de sens papier). */}
                  {!isPartial && (() => {
                    const exp = parseFloat(draft.expectedValue);
                    if (!Number.isFinite(exp) || exp === 0) return null;
                    const deltaPct = ((result.finalValue - exp) / Math.abs(exp)) * 100;
                    const ok = Math.abs(deltaPct) <= DEFAULT_TOLERANCE_PCT;
                    return (
                      <div style={{
                        display: 'inline-block', marginTop: 10, padding: '6px 14px', borderRadius: 6,
                        backgroundColor: ok ? 'var(--status-success)' : 'var(--color-red-critical)',
                        color: 'white', fontSize: 'var(--fs-body)', fontWeight: 600
                      }}>
                        Papier : {exp}{unit ? ` ${unit}` : ''} · écart {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)} %
                        <span style={{ fontWeight: 400, marginLeft: 8 }}>
                          {ok ? `✓ dans la tolérance (±${DEFAULT_TOLERANCE_PCT} %)` : deltaPct > 0 ? 'calcul AU-DESSUS du papier' : 'calcul EN DESSOUS du papier'}
                        </span>
                      </div>
                    );
                  })()}
                  {/* R13 — un clic transforme ce calcul en cas de référence du
                      banc de test : les entrées sont reprises, il ne reste qu'à
                      taper le résultat ATTENDU lu sur le papier. Lot 1-F :
                      chaîne complète uniquement (le banc rejoue tout le set). */}
                  {!isPartial && onProposeReference && (
                    <button
                      onClick={() => {
                        const parametersNum: Record<string, number> = {};
                        for (const g of evaluableChain) {
                          const v = parseFloat(draft.parameters[g.id]);
                          if (!isNaN(v)) parametersNum[g.id] = v;
                        }
                        // R19 — l'attendu saisi pour la comparaison live part
                        // avec le snapshot : le cas de référence naît complet.
                        const exp = parseFloat(draft.expectedValue);
                        onProposeReference({
                          inputValue: parseFloat(draft.inputValue),
                          parameters: parametersNum,
                          ...(draft.windDirection !== 'all' ? { windDirection: draft.windDirection } : {}),
                          computed: result.finalValue,
                          ...(Number.isFinite(exp) ? { expected: exp } : {})
                        });
                        setReferencePinned(true);
                      }}
                      style={{
                        marginTop: 10, padding: '5px 12px', fontSize: 'var(--fs-body)', cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.15)', color: 'white',
                        border: '1px solid white', borderRadius: 4, fontWeight: 500
                      }}
                      title="Reprend ces entrées dans le banc de test — tape ensuite le résultat attendu du manuel"
                    >
                      📌 En faire un cas de référence
                    </button>
                  )}
                  {/* Confirmation discrète du 📌 (Lot 1-F : le panneau du banc
                      est désormais monté sous le testeur, aux deux écrans). */}
                  {!isPartial && onProposeReference && referencePinned && (
                    <div style={{
                      marginTop: 6, fontSize: 'var(--fs-caption)',
                      color: 'rgba(255,255,255,0.9)', fontWeight: 500
                    }}>
                      ✓ Repris dans le banc de test
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};