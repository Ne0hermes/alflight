// src/features/aircraft/components/ManexExtractionReview.jsx
//
// Écran de validation des champs extraits automatiquement d'un MANEX par l'IA.
// Affiche un tableau : Champ | Valeur (éditable) | Unité storage | Unité MANEX | Confiance | Action
// L'utilisateur peut accepter/refuser/modifier chaque champ avant injection dans le wizard.

import React, { memo, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, X, Loader2, Sparkles } from 'lucide-react';

const confidenceColor = (c) => {
  if (c >= 85) return '#10b981';
  if (c >= 70) return '#eab308';
  if (c >= 50) return '#f97316';
  return '#ef4444';
};

// Helper : détermine si une valeur "courante" est considérée comme "saisie"
const hasValue = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const Row = memo(({ item, onChange }) => {
  const isAccepted = item.accepted;
  const isMissing = !item.found; // Champ non extrait par l'IA
  const hasOptions = Array.isArray(item.options) && item.options.length > 0;
  const isMulti = item.type === 'enum_multi';

  // Styles ligne selon état
  const rowBg = isMissing
    ? '#fff7ed'
    : isAccepted
      ? '#f0fdf4'
      : '#fafafa';

  // Handler unifié de changement de valeur (auto-accept si on remplit un champ manquant)
  const handleValueChange = (newValue) => {
    const valuePresent = hasValue(newValue);
    const newAccepted = isMissing && valuePresent ? true : item.accepted;
    onChange({
      ...item,
      value: newValue,
      accepted: newAccepted,
      found: item.found || valuePresent
    });
  };

  return (
    <tr style={{
      backgroundColor: rowBg,
      opacity: isMissing ? 0.85 : (isAccepted ? 1 : 0.6),
      borderBottom: '1px solid #e5e7eb'
    }}>
      {/* COLONNE — Champ */}
      <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: 13 }}>
        {item.label}
        {isMissing && (
          <span style={{
            display: 'inline-block', marginLeft: 6,
            padding: '1px 6px', borderRadius: 3, fontSize: 10,
            backgroundColor: '#fed7aa', color: '#9a3412', fontWeight: 700
          }}>
            ⚠ Manquant
          </span>
        )}
      </td>

      {/* COLONNE — Valeur (éditable). 3 variantes selon item.type */}
      <td style={{ padding: '8px 12px' }}>
        {hasOptions && isMulti ? (
          /* ─── MULTI-SELECT (checkboxes) ─── */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 4,
            padding: '4px 6px',
            border: isMissing ? '1px dashed #fb923c' : '1px solid #d1d5db',
            borderRadius: 4,
            backgroundColor: 'white',
            maxHeight: 120,
            overflowY: 'auto'
          }}>
            {item.options.map(opt => {
              const checked = Array.isArray(item.value) && item.value.includes(opt.value);
              return (
                <label key={opt.value} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const current = Array.isArray(item.value) ? item.value : [];
                      const next = e.target.checked
                        ? [...current, opt.value]
                        : current.filter(v => v !== opt.value);
                      handleValueChange(next);
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        ) : hasOptions ? (
          /* ─── SELECT mono (liste déroulante) ─── */
          <select
            value={item.value ?? ''}
            onChange={(e) => handleValueChange(e.target.value || null)}
            style={{
              width: '100%',
              padding: '4px 8px',
              border: isMissing ? '1px dashed #fb923c' : '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 13,
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="">— Sélectionner —</option>
            {item.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : item.type === 'boolean' ? (
          /* ─── CHECKBOX TRI-ÉTAT pour booléens équipement/opérations ───
             3 états : true (installé) / false (absent) / null (non analysé)
          */
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                checked={item.value === true}
                onChange={() => handleValueChange(true)}
              />
              ✅ Présent
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                checked={item.value === false}
                onChange={() => handleValueChange(false)}
              />
              ❌ Absent
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#9ca3af' }}>
              <input
                type="radio"
                checked={item.value === null || item.value === undefined}
                onChange={() => handleValueChange(null)}
              />
              ⏳ N/A
            </label>
          </div>
        ) : (
          /* ─── INPUT texte / number (cas standard) ─── */
          <input
            type={item.type === 'string' ? 'text' : 'number'}
            value={item.value ?? ''}
            placeholder={isMissing ? 'Saisir manuellement…' : ''}
            onChange={(e) => {
              const raw = e.target.value;
              let newValue;
              if (item.type === 'string') {
                newValue = raw;
              } else {
                newValue = raw === '' ? null : Number(raw);
                if (!Number.isFinite(newValue)) newValue = null;
              }
              handleValueChange(newValue);
            }}
            style={{
              width: '100%',
              padding: '4px 8px',
              border: isMissing ? '1px dashed #fb923c' : '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 13,
              backgroundColor: 'white'
            }}
          />
        )}
      </td>

      {/* COLONNE — Unité cible */}
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>
        {item.targetUnit || '—'}
      </td>

      {/* COLONNE — Source MANEX (valeur brute IA) */}
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af' }}>
        {isMissing
          ? <span style={{ fontStyle: 'italic' }}>—</span>
          : <>{Array.isArray(item.originalValue) ? item.originalValue.join(', ') : item.originalValue} {item.originalUnit || ''}</>}
      </td>

      {/* COLONNE — Page MANEX (NEW) */}
      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>
        {item.sourcePage ? (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 10,
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            fontWeight: 600,
            fontSize: 11
          }} title="Numéro de page du MANEX où la donnée a été extraite">
            p. {item.sourcePage}
          </span>
        ) : (
          <span style={{ color: '#cbd5e1' }}>—</span>
        )}
      </td>

      {/* COLONNE — Confiance */}
      <td style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          borderRadius: 12,
          backgroundColor: isMissing ? '#fed7aa' : confidenceColor(item.confidence) + '20',
          color: isMissing ? '#9a3412' : confidenceColor(item.confidence),
          fontSize: 12,
          fontWeight: 600
        }}>
          {isMissing ? '—' : `${item.confidence}%`}
        </div>
      </td>

      {/* COLONNE — Importer (checkbox) */}
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <label style={{ cursor: hasValue(item.value) ? 'pointer' : 'not-allowed' }}>
          <input
            type="checkbox"
            checked={isAccepted}
            disabled={!hasValue(item.value)}
            onChange={(e) => onChange({ ...item, accepted: e.target.checked })}
            style={{ marginRight: 4, cursor: 'inherit' }}
          />
        </label>
      </td>
    </tr>
  );
});
Row.displayName = 'ManexExtractionReview.Row';

const ManexExtractionReview = memo(({
  isLoading,
  progress,
  progressMessage,
  metadata,
  items,
  onItemsChange,
  onApply,
  onCancel
}) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'accepted' | 'lowConfidence'

  const filteredItems = useMemo(() => {
    if (filter === 'accepted') return items.filter(it => it.accepted);
    if (filter === 'lowConfidence') return items.filter(it => it.found && it.confidence < 70);
    if (filter === 'missing') return items.filter(it => !it.found);
    if (filter === 'found') return items.filter(it => it.found);
    return items;
  }, [items, filter]);

  const acceptedCount = items.filter(it => it.accepted).length;
  const foundCount = items.filter(it => it.found).length;
  const missingCount = items.filter(it => !it.found).length;
  const lowConfidenceCount = items.filter(it => it.found && it.confidence < 70).length;

  const handleRowChange = (newItem) => {
    onItemsChange(items.map(it => it.aircraftPath === newItem.aircraftPath ? newItem : it));
  };

  const handleAcceptAll = () => {
    onItemsChange(items.map(it => ({ ...it, accepted: true })));
  };

  const handleAcceptHighConfidence = () => {
    onItemsChange(items.map(it => ({ ...it, accepted: it.confidence >= 70 })));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 12, padding: 24,
        maxWidth: 1100, width: '95%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Sparkles size={22} color="#8b5cf6" />
            Validation des données extraites du MANEX
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={24} />
          </button>
        </div>

        {/* Loader pendant extraction */}
        {isLoading && (
          <div style={{
            padding: 32, textAlign: 'center',
            backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 16
          }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>{progressMessage || 'Analyse en cours...'}</div>
            <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                backgroundColor: '#8b5cf6', transition: 'width 0.3s'
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{progress}%</div>
          </div>
        )}

        {/* Métadonnées */}
        {!isLoading && metadata && (
          <div style={{
            display: 'flex', gap: 16, marginBottom: 12,
            padding: '12px 16px', backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd', borderRadius: 8
          }}>
            <div><strong>{foundCount}</strong>/{items.length} champs extraits</div>
            <div>
              {metadata.pagesAnalyzed} page{metadata.pagesAnalyzed > 1 ? 's' : ''} analysée{metadata.pagesAnalyzed > 1 ? 's' : ''}
              {metadata.pagesWithData !== undefined && (
                <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>
                  ({metadata.pagesWithData} avec données, {metadata.pagesEmpty || 0} vides)
                </span>
              )}
            </div>
            <div>Confiance moyenne : <strong style={{ color: confidenceColor(metadata.overallConfidence) }}>{metadata.overallConfidence}%</strong></div>
            {missingCount > 0 && (
              <div style={{ color: '#9a3412' }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
                {missingCount} manquant{missingCount > 1 ? 's' : ''} à compléter
              </div>
            )}
            {lowConfidenceCount > 0 && (
              <div style={{ color: '#b45309', marginLeft: 'auto' }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
                {lowConfidenceCount} à vérifier
              </div>
            )}
          </div>
        )}

        {/* Actions rapides */}
        {!isLoading && items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button onClick={handleAcceptHighConfidence} style={btnSecondary}>
              Accepter ≥ 70%
            </button>
            <button onClick={handleAcceptAll} style={btnSecondary}>
              Tout accepter
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setFilter('all')} style={filter === 'all' ? btnTabActive : btnTab}>
                Tous ({items.length})
              </button>
              <button onClick={() => setFilter('found')} style={filter === 'found' ? btnTabActive : btnTab}>
                Extraits ({foundCount})
              </button>
              <button onClick={() => setFilter('missing')} style={filter === 'missing' ? btnTabActive : btnTab}
                title="Champs non trouvés par l'IA — à remplir manuellement">
                ⚠ Manquants ({missingCount})
              </button>
              <button onClick={() => setFilter('lowConfidence')} style={filter === 'lowConfidence' ? btnTabActive : btnTab}>
                À vérifier ({lowConfidenceCount})
              </button>
              <button onClick={() => setFilter('accepted')} style={filter === 'accepted' ? btnTabActive : btnTab}>
                ✓ Importables ({acceptedCount})
              </button>
            </div>
          </div>
        )}

        {/* Tableau */}
        {!isLoading && (
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={th}>Champ</th>
                  <th style={th}>Valeur (storage)</th>
                  <th style={th}>Unité cible</th>
                  <th style={th}>Source MANEX (brut IA)</th>
                  <th style={{ ...th, textAlign: 'center' }} title="Numéro de page du MANEX d'origine">📄 Page</th>
                  <th style={th}>Confiance</th>
                  <th style={{ ...th, textAlign: 'center' }}>Importer</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                      {items.length === 0 ? 'Aucune donnée extraite' : 'Aucun champ ne correspond au filtre'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <Row key={item.aircraftPath} item={item} onChange={handleRowChange} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onCancel} style={btnGhost}>
            Annuler
          </button>
          <button
            onClick={onApply}
            disabled={isLoading || acceptedCount === 0}
            style={{
              ...btnPrimary,
              opacity: (isLoading || acceptedCount === 0) ? 0.5 : 1,
              cursor: (isLoading || acceptedCount === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            <CheckCircle2 size={16} />
            Importer {acceptedCount} champ{acceptedCount > 1 ? 's' : ''} dans le wizard
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
});
ManexExtractionReview.displayName = 'ManexExtractionReview';

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const btnPrimary = { padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' };
const btnGhost = { padding: '8px 16px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const btnTab = { padding: '4px 10px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, fontSize: 12, cursor: 'pointer' };
const btnTabActive = { ...btnTab, backgroundColor: '#8b5cf6', color: 'white', borderColor: '#8b5cf6' };

export default ManexExtractionReview;
