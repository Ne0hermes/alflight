import React, { useState, useEffect } from 'react';
import { useVACStore } from '../store/vacStore';
import { ZoomIn, ZoomOut, RotateCw, Download, Printer } from 'lucide-react';

export const VACChartViewer = ({ chart }) => {
  const { getChartPDF } = useVACStore();
  const [state, setState] = useState({ url: null, loading: true, error: null, scale: 100, rotation: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const blob = await getChartPDF(chart.id);
        setState(s => ({ ...s, url: blob ? URL.createObjectURL(blob) : null, loading: false, 
          error: blob ? null : 'Carte non trouvée' }));
      } catch (err) {
        setState(s => ({ ...s, loading: false, error: 'Erreur chargement' }));
      }
    };
    load();
    return () => state.url && URL.revokeObjectURL(state.url);
  }, [chart.id]);

  const act = (k, v) => setState(s => ({ ...s, [k]: v }));
  const zoom = d => act('scale', Math.min(Math.max(50, state.scale + d), 300));
  const rotate = () => act('rotation', (state.rotation + 90) % 360);
  
  const dl = () => {
    if (!state.url) return;
    const a = document.createElement('a');
    Object.assign(a, { href: state.url, download: `${chart.airportIcao}_${chart.type}_${chart.version}.pdf` });
    a.click();
  };

  if (state.loading) return (
    <div style={{ ...S.center, ...S.flex('column'), height: '100%', ...S.bg('#f3f4f6') }}>
      <div style={{ ...S.b(3, '#e5e7eb'), borderTopColor: '#3b82f6', ...S.br(50), width: 40, height: 40, animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b7280', marginTop: 16 }}>Chargement...</p>
    </div>
  );

  if (state.error) return (
    <div style={{ ...S.center, height: '100%', ...S.bg('#f3f4f6') }}>
      <div style={{ textAlign: 'center', color: '#ef4444' }}>
        <p style={{ ...S.h(18), marginBottom: 8 }}>⚠️ {state.error}</p>
        <button onClick={() => window.location.reload()} style={{ ...S.btn('#ef4444', 'white') }}>Réessayer</button>
      </div>
    </div>
  );

  const toolbar = (
    <div style={{ ...S.flex(), ...S.p('12px 16px'), ...S.bg('white'), borderBottom: '1px solid #e5e7eb', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ ...S.h(16, '600'), color: '#1f2937' }}>{chart.airportIcao} - {chart.type} (v{chart.version})</h3>
      <div style={{ ...S.flex(), ...S.gap(8) }}>
        <button onClick={() => zoom(-10)} style={S.btn()} title="Zoom -"><ZoomOut size={16} /></button>
        <span style={{ ...S.p('8px 12px'), ...S.bg('#f3f4f6'), ...S.br(6), minWidth: 60, textAlign: 'center' }}>{state.scale}%</span>
        <button onClick={() => zoom(10)} style={S.btn()} title="Zoom +"><ZoomIn size={16} /></button>
        <div style={{ width: 1, ...S.bg('#e5e7eb'), margin: '0 8px' }} />
        <button onClick={rotate} style={S.btn()} title="Rotation"><RotateCw size={16} /></button>
        <div style={{ width: 1, ...S.bg('#e5e7eb'), margin: '0 8px' }} />
        <button onClick={() => state.url && window.open(state.url).print()} style={S.btn()} title="Imprimer"><Printer size={16} /></button>
        <button onClick={dl} style={S.btn()} title="Télécharger"><Download size={16} /></button>
      </div>
    </div>
  );

  return (
    <div style={{ ...S.flex('column'), height: '100%', ...S.bg('#f3f4f6') }}>
      {toolbar}
      <div style={{ flex: 1, overflow: 'auto', ...S.center, ...S.p(20) }}>
        {state.url && <iframe src={state.url} style={{ width: '100%', height: '100%', maxWidth: 1000, ...S.b(), ...S.br(8), ...S.bg('white'), transform: `scale(${state.scale / 100}) rotate(${state.rotation}deg)`, transformOrigin: 'center', transition: 'transform 0.3s' }} title="VAC Chart" />}
      </div>
      <div style={{ ...S.p('12px 16px'), ...S.bg('white'), borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', ...S.flex(), justifyContent: 'space-between' }}>
        <span>Valide: {new Date(chart.effectiveDate).toLocaleDateString('fr-FR')} - {new Date(chart.expiryDate).toLocaleDateString('fr-FR')}</span>
        {chart.downloadDate && <span>Téléchargée: {new Date(chart.downloadDate).toLocaleDateString('fr-FR')}</span>}
      </div>
    </div>
  );
};


