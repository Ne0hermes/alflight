// src/abac/v2/AbacEditorDemoPage.jsx
//
// Page de démo / banc d'essai pour BezierAbacEditor.
// Permet de paramétrer les bornes d'axes puis d'ouvrir l'éditeur, et affiche
// le JSON v2 produit au moment du Save.

import React, { useState } from 'react';
import BezierAbacEditor from './BezierAbacEditor';

const AbacEditorDemoPage = () => {
  const [xMin, setXMin] = useState(0);
  const [xMax, setXMax] = useState(100);
  const [yMin, setYMin] = useState(0);
  const [yMax, setYMax] = useState(100);
  const [xTitle, setXTitle] = useState('Vitesse');
  const [xUnit, setXUnit] = useState('kt');
  const [yTitle, setYTitle] = useState('Distance');
  const [yUnit, setYUnit] = useState('m');

  const [savedJson, setSavedJson] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Éditeur d'abaque v2 — démonstrateur
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Charge une image de page d'abaque (PDF rasterisé en PNG/JPG), calibre l'image en cliquant
        2 coins du graphique, puis clique sur chaque point de la courbe. La courbe Bézier
        s'affiche en temps réel ; tu peux ensuite ajuster finement via les poignées vertes.
      </p>

      {!showEditor && (
        <div style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16, background: '#f9fafb' }}>
          <h3 style={{ marginTop: 0 }}>Configuration de l'abaque</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Field label="Axe X — titre" value={xTitle} onChange={setXTitle} />
            <Field label="Axe X — unité" value={xUnit} onChange={setXUnit} />
            <Field label="X min" value={xMin} onChange={(v) => setXMin(Number(v) || 0)} type="number" />
            <Field label="X max" value={xMax} onChange={(v) => setXMax(Number(v) || 100)} type="number" />
            <Field label="Axe Y — titre" value={yTitle} onChange={setYTitle} />
            <Field label="Axe Y — unité" value={yUnit} onChange={setYUnit} />
            <Field label="Y min" value={yMin} onChange={(v) => setYMin(Number(v) || 0)} type="number" />
            <Field label="Y max" value={yMax} onChange={(v) => setYMax(Number(v) || 100)} type="number" />
          </div>
          <button
            onClick={() => setShowEditor(true)}
            style={{
              marginTop: 16, padding: '10px 20px',
              background: '#8b5cf6', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer'
            }}
          >
            Ouvrir l'éditeur
          </button>
        </div>
      )}

      {showEditor && (
        <div style={{ height: '75vh', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <BezierAbacEditor
            dataBounds={{ xMin, xMax, yMin, yMax }}
            axes={{
              xAxis: { title: xTitle, unit: xUnit, min: xMin, max: xMax },
              yAxis: { title: yTitle, unit: yUnit, min: yMin, max: yMax }
            }}
            onSave={(json) => {
              setSavedJson(json);
              setShowEditor(false);
            }}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      )}

      {savedJson && !showEditor && (
        <div style={{ marginTop: 24 }}>
          <h3>JSON v2 exporté</h3>
          <pre style={{
            background: '#1f2937', color: '#f9fafb', padding: 16,
            borderRadius: 8, maxHeight: 400, overflow: 'auto', fontSize: 12
          }}>
            {JSON.stringify(savedJson, null, 2)}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(savedJson, null, 2));
            }}
            style={{
              padding: '6px 12px', background: '#10b981', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8
            }}
          >
            Copier dans le presse-papier
          </button>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text' }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '6px 10px',
        border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14
      }}
    />
  </label>
);

export default AbacEditorDemoPage;
