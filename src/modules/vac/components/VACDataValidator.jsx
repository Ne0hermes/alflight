import React, { useState } from 'react';
import { useVACStore } from '../store/vacStore';
import { X, Save, Eye } from 'lucide-react';

export const VACDataValidator = ({ chart, onClose }) => {
  const { updateExtractedData } = useVACStore();
  const [data, setData] = useState(chart.extractedData || {});
  const [preview, setPreview] = useState(false);

  const upd = (sec, idx, field, val) => {
    setData(d => {
      const n = { ...d };
      if (Array.isArray(n[sec])) {
        n[sec] = [...n[sec]];
        n[sec][idx] = { ...n[sec][idx], [field]: val };
      } else if (typeof n[sec] === 'object') {
        n[sec] = { ...n[sec], [field]: val };
      } else {
        n[sec] = val;
      }
      return n;
    });
  };

  const Field = ({ label, value, onChange, type = 'text', ...props }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(type === 'number' ? parseInt(e.target.value) : e.target.value)} style={S.input} {...props} />
    </div>
  );

  const Section = ({ title, icon, children }) => (
    <div style={{ ...S.p(16), ...S.bg('#f9fafb'), ...S.br(8), ...S.b(), marginBottom: 24 }}>
      <h3 style={{ ...S.h(16), color: '#1f2937', marginBottom: 12, ...S.flex(), ...S.gap(8), alignItems: 'center' }}>
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );

  const save = () => {
    updateExtractedData(chart.id, data);
    onClose();
  };

  return (
    <div style={{ ...S.flex(), height: '100%' }}>
      <div style={{ flex: 1, ...S.p(24), overflow: 'auto', ...S.bg('white') }}>
        <div style={{ ...S.flex(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ ...S.h(20) }}>Validation - {chart.airportIcao}</h2>
          <button onClick={onClose} style={{ ...S.p(8), background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <Section title="Pistes" icon="🛬">
          {data.runways?.map((r, i) => (
            <div key={i} style={{ ...S.p(12), ...S.bg('white'), ...S.br(6), marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <Field label="Identifiant" value={r.identifier} onChange={v => upd('runways', i, 'identifier', v)} pattern="[0-9]{2}[LCR]?" />
                <Field label="QFU (°)" value={r.qfu} onChange={v => upd('runways', i, 'qfu', v)} type="number" min="1" max="360" />
                <Field label="Longueur (m)" value={r.length} onChange={v => upd('runways', i, 'length', v)} type="number" />
                <Field label="Largeur (m)" value={r.width} onChange={v => upd('runways', i, 'width', v)} type="number" />
              </div>
            </div>
          ))}
          <button onClick={() => upd('runways', data.runways?.length || 0, null, { identifier: '', qfu: 0, length: 0, width: 0, surface: 'ASPH' })} style={S.btn()}>+ Ajouter piste</button>
        </Section>

        <Section title="Fréquences" icon="📻">
          {data.frequencies?.map((f, i) => (
            <div key={i} style={{ ...S.p(12), ...S.bg('white'), ...S.br(6), marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Type</label>
                  <select value={f.type || 'INFO'} onChange={e => upd('frequencies', i, 'type', e.target.value)} style={S.input}>
                    {['TWR', 'GND', 'ATIS', 'APP', 'INFO'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Field label="Fréquence" value={f.frequency} onChange={v => upd('frequencies', i, 'frequency', v)} pattern="1[0-3][0-9]\.[0-9]{1,3}" />
                <Field label="Horaires" value={f.hours} onChange={v => upd('frequencies', i, 'hours', v)} />
                <Field label="Téléphone" value={f.phone} onChange={v => upd('frequencies', i, 'phone', v)} type="tel" />
              </div>
            </div>
          ))}
          <button onClick={() => upd('frequencies', data.frequencies?.length || 0, null, { type: 'INFO', frequency: '', hours: '', phone: '' })} style={S.btn()}>+ Ajouter fréquence</button>
        </Section>

        <div style={{ ...S.flex(), ...S.gap(12), position: 'sticky', bottom: 0, ...S.bg('white'), ...S.p('16px 0'), borderTop: '1px solid #e5e7eb', marginTop: 24 }}>
          <button onClick={save} style={{ ...S.btn('#10b981'), flex: 1, ...S.flex(), alignItems: 'center', justifyContent: 'center', ...S.gap(8) }}><Save size={20} /> Enregistrer</button>
          <button onClick={() => setPreview(!preview)} style={{ ...S.btn(), ...S.flex(), alignItems: 'center', ...S.gap(8) }}><Eye size={20} /> Aperçu</button>
        </div>
      </div>

      {preview && (
        <div style={{ width: 400, borderLeft: '1px solid #e5e7eb', ...S.p(24), ...S.bg('#f9fafb'), overflow: 'auto' }}>
          <h3 style={{ ...S.h(18), marginBottom: 16 }}>Aperçu</h3>
          <pre style={{ ...S.bg('white'), ...S.p(16), ...S.br(8), fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};