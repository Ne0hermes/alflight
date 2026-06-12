// src/abac/curves/ui/ReferenceCasesPanel.tsx
//
// R13 — UI du BANC DE TEST PERMANENT : liste des cas de référence du modèle
// avec badge PASS/FAIL recalculé sur les graphes EN L'ÉTAT, + formulaire
// d'ajout (pré-remplissable d'un clic depuis un calcul du CascadeCalculator —
// il ne reste qu'à taper le résultat ATTENDU lu sur le papier).

import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GraphConfig, ReferenceCase } from '../core/types';
import { buildChain, runAllReferenceCases, DEFAULT_TOLERANCE_PCT } from '../core/referenceBench';
import { getAxisVariableLabel } from '../core/axisVariables';
import { formatOppositeUnit } from './CascadeCalculator';

export interface ReferencePrefill {
  inputValue: number;
  parameters: Record<string, number>;
  windDirection?: 'headwind' | 'tailwind';
  computed?: number;
}

interface ReferenceCasesPanelProps {
  graphs: GraphConfig[];
  cases: ReferenceCase[];
  onChange: (next: ReferenceCase[]) => void;
  /** Snapshot proposé par le CascadeCalculator (« En faire un cas de référence »). */
  prefill?: ReferencePrefill | null;
  onPrefillConsumed?: () => void;
}

const inputStyle: React.CSSProperties = {
  width: 90, padding: '4px 6px', fontSize: 12, borderRadius: 3,
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
};

const badgeStyle = (status: 'pass' | 'fail' | 'error'): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
  color: 'white',
  backgroundColor: status === 'pass' ? 'var(--status-success)'
    : status === 'fail' ? 'var(--color-red-critical)'
    : 'var(--accent-primary)'
});

export const ReferenceCasesPanel: React.FC<ReferenceCasesPanelProps> = ({
  graphs, cases, onChange, prefill = null, onPrefillConsumed
}) => {
  const chain = useMemo(() => buildChain(graphs), [graphs]);
  const results = useMemo(() => runAllReferenceCases(graphs, cases), [graphs, cases]);
  const lastGraph = chain[chain.length - 1];
  const expectedUnit = lastGraph?.axes?.yAxis?.unit || '';
  const hasWindGraph = chain.some(g => g.isWindRelated);

  // ─── Formulaire d'ajout ───
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [windDirection, setWindDirection] = useState<'headwind' | 'tailwind' | ''>('');
  const [expected, setExpected] = useState('');
  const [tolerance, setTolerance] = useState(String(DEFAULT_TOLERANCE_PCT));

  // Pré-remplissage depuis le calculateur : on garde les ENTRÉES, le pilote
  // tape le résultat ATTENDU lu sur le papier (jamais le calculé !).
  React.useEffect(() => {
    if (!prefill) return;
    setFormOpen(true);
    setInputValue(String(prefill.inputValue));
    setParamValues(Object.fromEntries(Object.entries(prefill.parameters).map(([k, v]) => [k, String(v)])));
    setWindDirection(prefill.windDirection || '');
    setExpected('');
    onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const addCase = () => {
    const iv = parseFloat(inputValue);
    const exp = parseFloat(expected);
    if (isNaN(iv) || isNaN(exp)) return;
    const parameters: Record<string, number> = {};
    for (const g of chain) {
      const v = parseFloat(paramValues[g.id]);
      if (!isNaN(v)) parameters[g.id] = v;
    }
    const tol = parseFloat(tolerance);
    onChange([
      ...cases,
      {
        id: uuidv4(),
        ...(label.trim() ? { label: label.trim() } : {}),
        inputValue: iv,
        parameters,
        ...(hasWindGraph && windDirection ? { windDirection } : {}),
        expected: exp,
        ...(!isNaN(tol) && tol !== DEFAULT_TOLERANCE_PCT ? { tolerancePct: tol } : {})
      }
    ]);
    setLabel(''); setInputValue(''); setParamValues({}); setWindDirection(''); setExpected('');
    setTolerance(String(DEFAULT_TOLERANCE_PCT));
    setFormOpen(false);
  };

  const nbPass = results.filter(r => r.status === 'pass').length;
  const nbFail = results.length - nbPass;

  return (
    <div style={{
      marginBottom: 16, border: `1px solid ${nbFail > 0 && cases.length > 0 ? 'var(--color-red-critical)' : 'var(--border-subtle)'}`,
      borderRadius: 6, backgroundColor: 'var(--bg-overlay)'
    }}>
      <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        🧪 Banc de test — cas de référence du manuel
        {cases.length > 0 && (
          <span style={{ fontWeight: 400, fontSize: 12, color: nbFail > 0 ? 'var(--color-red-critical)' : 'var(--status-success)' }}>
            {nbPass}/{results.length} OK{nbFail > 0 ? ` · ${nbFail} en échec` : ''}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setFormOpen(v => !v)}
          style={{ padding: '3px 10px', fontSize: 12, cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 3 }}
        >
          {formOpen ? '✕ Fermer' : '＋ Ajouter un cas'}
        </button>
      </div>

      {cases.length === 0 && !formOpen && (
        <div style={{ padding: '0 12px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
          Saisis les exemples chiffrés du manuel (entrées + résultat attendu) : ils seront
          <strong> rejoués automatiquement</strong> à chaque modification du modèle. Astuce : lance un
          calcul dans le test de cascade puis « En faire un cas de référence ».
        </div>
      )}

      {/* ─── Tableau des cas ─── */}
      {cases.length > 0 && (
        <div style={{ padding: '0 8px 8px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Cas', 'Entrées', 'Attendu', 'Calculé', 'Écart', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((rc, i) => {
                const r = results[i];
                const entries = [
                  `${rc.inputValue}${chain[0]?.axes?.xAxis?.unit ? ' ' + chain[0].axes.xAxis.unit : ''}`,
                  ...chain.map(g => rc.parameters[g.id] !== undefined && g.id !== chain[0]?.id
                    ? `${getAxisVariableLabel(g.axes?.xAxis?.title)} ${rc.parameters[g.id]}${g.axes?.xAxis?.unit ? ' ' + g.axes.xAxis.unit : ''}`
                    : (g.id === chain[0]?.id && rc.parameters[g.id] !== undefined ? `alt ${rc.parameters[g.id]}` : null)
                  ).filter(Boolean),
                  ...(rc.windDirection ? [rc.windDirection === 'headwind' ? 'vent de face' : 'vent arrière'] : [])
                ].join(' · ');
                return (
                  <tr key={rc.id}>
                    <td style={{ padding: '5px 8px', verticalAlign: 'top' }}>
                      <span style={badgeStyle(r.status)}>
                        {r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'ERREUR'}
                      </span>
                      {rc.label && <div style={{ marginTop: 3, color: 'var(--text-secondary)' }}>{rc.label}</div>}
                    </td>
                    <td style={{ padding: '5px 8px', verticalAlign: 'top', color: 'var(--text-primary)' }}>{entries}</td>
                    <td style={{ padding: '5px 8px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {rc.expected}{expectedUnit ? ` ${expectedUnit}` : ''}
                    </td>
                    <td style={{ padding: '5px 8px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {r.computed !== undefined
                        ? <>{r.computed.toFixed(0)}{expectedUnit ? ` ${expectedUnit}` : ''}{(() => { const o = formatOppositeUnit(r.computed, expectedUnit); return o ? <span style={{ color: 'var(--text-secondary)' }}> ({o})</span> : null; })()}</>
                        : <span style={{ color: 'var(--color-red-critical)' }} title={r.message}>{(r.message || '—').slice(0, 60)}</span>}
                    </td>
                    <td style={{ padding: '5px 8px', verticalAlign: 'top', whiteSpace: 'nowrap', color: r.status === 'fail' ? 'var(--color-red-critical)' : 'var(--text-primary)' }}>
                      {r.deviationPct !== undefined ? `${r.deviationPct.toFixed(1)} %` : '—'}
                      <span style={{ color: 'var(--text-tertiary)' }}> / ±{rc.tolerancePct ?? DEFAULT_TOLERANCE_PCT} %</span>
                    </td>
                    <td style={{ padding: '5px 4px', verticalAlign: 'top' }}>
                      <button
                        onClick={() => onChange(cases.filter(c => c.id !== rc.id))}
                        title="Supprimer ce cas"
                        style={{ padding: '1px 7px', fontSize: 12, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--color-red-critical)', border: '1px solid var(--color-red-critical)', borderRadius: 3 }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Formulaire d'ajout ─── */}
      {formOpen && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)' }}>
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            Libellé (optionnel)
            <input style={{ ...inputStyle, width: 150 }} value={label} onChange={e => setLabel(e.target.value)} placeholder="Exemple POH p.5-9" />
          </label>
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            {getAxisVariableLabel(chain[0]?.axes?.xAxis?.title) || 'Entrée'}{chain[0]?.axes?.xAxis?.unit ? ` (${chain[0].axes.xAxis.unit})` : ''}
            <input style={inputStyle} type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} />
          </label>
          {chain.map((g, i) => (
            <label key={g.id} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              {i === 0 ? 'Altitude (optionnel)' : `${getAxisVariableLabel(g.axes?.xAxis?.title)}${g.axes?.xAxis?.unit ? ` (${g.axes.xAxis.unit})` : ''}`}
              <input
                style={inputStyle}
                type="number"
                value={paramValues[g.id] ?? ''}
                onChange={e => setParamValues(prev => ({ ...prev, [g.id]: e.target.value }))}
              />
            </label>
          ))}
          {hasWindGraph && (
            <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              Direction du vent
              <select style={{ ...inputStyle, width: 120 }} value={windDirection} onChange={e => setWindDirection(e.target.value as any)}>
                <option value="">— choisir —</option>
                <option value="headwind">Vent de face</option>
                <option value="tailwind">Vent arrière</option>
              </select>
            </label>
          )}
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, color: 'var(--accent-primary)', fontWeight: 600 }}>
            Attendu (papier){expectedUnit ? ` (${expectedUnit})` : ''}
            <input style={{ ...inputStyle, border: '1px solid var(--accent-primary)' }} type="number" value={expected} onChange={e => setExpected(e.target.value)} />
          </label>
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            Tolérance (%)
            <input style={{ ...inputStyle, width: 56 }} type="number" value={tolerance} onChange={e => setTolerance(e.target.value)} />
          </label>
          <button
            onClick={addCase}
            disabled={isNaN(parseFloat(inputValue)) || isNaN(parseFloat(expected)) || (hasWindGraph && !windDirection)}
            style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              backgroundColor: 'var(--status-success)', color: 'white', border: 'none', borderRadius: 3,
              opacity: isNaN(parseFloat(inputValue)) || isNaN(parseFloat(expected)) || (hasWindGraph && !windDirection) ? 0.4 : 1
            }}
          >
            ✓ Enregistrer ce cas
          </button>
        </div>
      )}
    </div>
  );
};
