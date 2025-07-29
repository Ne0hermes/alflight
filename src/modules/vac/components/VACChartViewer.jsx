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

// === VACModule.jsx OPTIMISÉ ===
import React, { useEffect, useState } from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { useVACStore } from '../store/vacStore';
import { Search, Download, Trash2, CheckCircle, AlertCircle, HardDrive, Cloud, Map, Navigation } from 'lucide-react';
import { VACChartViewer } from './VACChartViewer';
import { VACDataValidator } from './VACDataValidator';

export const VACModule = () => {
  const { waypoints } = useFlightSystem();
  const store = useVACStore();
  const { charts, selectedAirport, downloadQueue, isOnline, storageUsed, storageQuota, loadChartsList, downloadChart, deleteChart, selectAirport, syncCharts, checkStorageQuota } = store;
  
  const [state, setState] = useState({ query: '', chart: null, validator: false });
  const upd = (k, v) => setState(s => ({ ...s, [k]: v }));
  
  const dep = waypoints[0]?.name;
  const arr = waypoints[waypoints.length - 1]?.name;
  const navAirports = [dep, arr].filter((a, i, ar) => a && ar.indexOf(a) === i);

  useEffect(() => {
    loadChartsList();
    checkStorageQuota();
    const onl = () => store.setState({ isOnline: true });
    const off = () => store.setState({ isOnline: false });
    window.addEventListener('online', onl);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', onl);
      window.removeEventListener('offline', off);
    };
  }, []);

  const filtered = Object.values(charts).filter(c => {
    if (navAirports.length && !state.query && !selectedAirport) return navAirports.includes(c.airportIcao);
    if (selectedAirport) return c.airportIcao === selectedAirport;
    if (state.query) {
      const q = state.query.toUpperCase();
      return c.airportIcao.includes(q) || c.airportName.toLowerCase().includes(state.query.toLowerCase());
    }
    return navAirports.includes(c.airportIcao);
  });

  const fmt = (b) => {
    if (!b) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + ' ' + s[i];
  };

  const dt = d => new Date(d).toLocaleDateString('fr-FR');
  
  const ChartItem = ({ chart }) => {
    const isNav = navAirports.includes(chart.airportIcao);
    const sel = state.chart?.id === chart.id;
    
    return (
      <div
        style={{ ...S.p('12px 16px'), borderBottom: '1px solid #e5e7eb', cursor: 'pointer', 
          backgroundColor: sel ? '#eff6ff' : isNav ? '#f0fdf4' : 'transparent',
          borderLeft: isNav ? '4px solid #10b981' : 'none', transition: 'background-color 0.2s' }}
        onClick={() => upd('chart', chart)}
        onMouseEnter={e => !sel && !isNav && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
        onMouseLeave={e => !sel && !isNav && (e.currentTarget.style.backgroundColor = 'transparent')}>
        <div style={{ ...S.flex(), justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ ...S.h(16), color: '#1f2937', ...S.flex(), alignItems: 'center', ...S.gap(8), marginBottom: 4 }}>
              {chart.airportIcao} - {chart.airportName}
              {isNav && (
                <span style={{ ...S.p('2px 8px'), ...S.bg('#d1fae5'), color: '#065f46', ...S.br(4), fontSize: 11, fontWeight: '500', ...S.flex(), alignItems: 'center', ...S.gap(4) }}>
                  <Navigation size={12} />{chart.airportIcao === dep ? 'Départ' : 'Arrivée'}
                </span>
              )}
            </h4>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              {chart.type} v{chart.version} | {dt(chart.effectiveDate)} - {dt(chart.expiryDate)}
            </p>
          </div>
          <div style={{ ...S.flex('column'), ...S.gap(4), alignItems: 'flex-end' }}>
            {chart.isDownloaded ? <CheckCircle size={16} style={{ color: '#10b981' }} /> : <Download size={16} style={{ color: '#6b7280' }} />}
            {chart.isOutdated && <AlertCircle size={16} style={{ color: '#f59e0b' }} />}
          </div>
        </div>
        <div style={{ marginTop: 8, ...S.flex(), ...S.gap(8) }}>
          {!chart.isDownloaded ? (
            <button onClick={e => { e.stopPropagation(); downloadChart(chart.id); }} 
              disabled={downloadQueue.includes(chart.id) || !isOnline}
              style={{ ...S.btn(), opacity: downloadQueue.includes(chart.id) || !isOnline ? 0.5 : 1 }}>
              {downloadQueue.includes(chart.id) ? 'Téléchargement...' : 'Télécharger'}
            </button>
          ) : (
            <>
              <button onClick={e => { e.stopPropagation(); upd('chart', chart); }} style={S.btn()}>Afficher</button>
              {chart.extractionStatus === 'completed' && (
                <button onClick={e => { e.stopPropagation(); upd('chart', chart); upd('validator', true); }} style={S.btn('#10b981')}>Valider</button>
              )}
              <button onClick={e => { e.stopPropagation(); window.confirm('Supprimer ?') && deleteChart(chart.id); }} 
                style={{ ...S.btn('#ef4444'), ...S.p('4px 8px') }}><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </div>
    );
  };

  const sidebar = (
    <div style={{ width: 350, borderRight: '1px solid #e5e7eb', ...S.flex('column'), ...S.bg('#f9fafb') }}>
      <div style={{ ...S.p(16), borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ ...S.flex(), alignItems: 'center', ...S.gap(12), marginBottom: 12 }}>
          <Map size={24} style={{ color: '#3b82f6' }} />
          <h2 style={{ ...S.h(20) }}>Cartes VAC</h2>
          <div style={{ marginLeft: 'auto', ...S.flex(), ...S.gap(8), alignItems: 'center' }}>
            {isOnline ? <Cloud size={16} style={{ color: '#10b981' }} /> : <HardDrive size={16} style={{ color: '#f59e0b' }} />}
            <span style={{ fontSize: 12, color: '#6b7280' }}>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        </div>
        
        {navAirports.length > 0 && (
          <div style={{ ...S.p(8), ...S.bg('#eff6ff'), ...S.br(6), fontSize: 12, color: '#1e40af', ...S.flex(), alignItems: 'center', ...S.gap(8), marginBottom: 12 }}>
            <Navigation size={14} />
            <span>Navigation : <strong>{navAirports.join(' → ')}</strong></span>
            {(state.query || selectedAirport) && (
              <button onClick={() => { upd('query', ''); selectAirport(null); }} 
                style={{ marginLeft: 'auto', ...S.p('2px 8px'), ...S.bg('#3b82f6'), color: 'white', border: 'none', ...S.br(4), fontSize: 11, cursor: 'pointer' }}>
                Retour
              </button>
            )}
          </div>
        )}
        
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input type="text" placeholder="Rechercher..." value={state.query} onChange={e => upd('query', e.target.value)} 
            style={{ ...S.input, paddingLeft: 36 }} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ ...S.flex(), justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#6b7280' }}>Stockage</span>
            <span style={{ color: '#374151' }}>{fmt(storageUsed)} / {fmt(storageQuota)}</span>
          </div>
          <div style={{ width: '100%', height: 4, ...S.bg('#e5e7eb'), ...S.br(2), overflow: 'hidden' }}>
            <div style={{ width: `${storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0}%`, height: '100%', 
              ...S.bg(storageUsed / storageQuota > 0.8 ? '#ef4444' : '#3b82f6'), transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ ...S.p(32), textAlign: 'center', color: '#6b7280' }}>
            <Map size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>Aucune carte trouvée</p>
          </div>
        ) : filtered.map(c => <ChartItem key={c.id} chart={c} />)}
      </div>

      <div style={{ ...S.p(16), borderTop: '1px solid #e5e7eb' }}>
        <button onClick={syncCharts} disabled={!isOnline} 
          style={{ ...S.btn(isOnline ? '#3b82f6' : '#e5e7eb', isOnline ? 'white' : '#9ca3af'), width: '100%', fontWeight: '500', cursor: isOnline ? 'pointer' : 'not-allowed' }}>
          Synchroniser
        </button>
      </div>
    </div>
  );

  const main = (
    <div style={{ flex: 1, ...S.flex('column') }}>
      {state.chart && state.chart.isDownloaded ? (
        state.validator ? <VACDataValidator chart={state.chart} onClose={() => upd('validator', false)} /> : <VACChartViewer chart={state.chart} />
      ) : (
        <div style={{ flex: 1, ...S.center, color: '#6b7280' }}>
          <div style={{ textAlign: 'center' }}>
            <Map size={64} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: 18, marginBottom: 8 }}>Sélectionnez une carte</p>
            <p style={{ fontSize: 14 }}>Téléchargez pour accès hors ligne</p>
            {navAirports.length > 0 && <p style={{ fontSize: 14, marginTop: 16, color: '#10b981' }}>Les cartes de navigation sont prioritaires</p>}
          </div>
        </div>
      )}
    </div>
  );

  return <div style={{ ...S.flex(), height: 600, position: 'relative' }}>{sidebar}{main}</div>;
};
