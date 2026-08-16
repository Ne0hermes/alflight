// src/features/aircraft/components/SendManualRequestButton.jsx
// 🔐 Phase 1 RBAC — parcours UTILISATEUR quand son avion n'est pas dans la
// base communautaire : un petit FORMULAIRE structuré qui prépare un e-mail
// à l'assistance (l'admin ajoute ensuite l'avion au référentiel).
// Décision César 2026-08-16. NB : un e-mail ne peut pas joindre un fichier
// automatiquement depuis le navigateur — le formulaire rappelle au pilote
// de joindre le PDF du manuel avant l'envoi.

import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';

export const SUPPORT_EMAIL = 'assistance@alflight.fr';

const SendManualRequestButton = ({ style }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ registration: '', model: '', message: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSend = () => {
    const subject = `Demande d'ajout avion — ${form.registration.trim().toUpperCase() || 'immatriculation à préciser'}`;
    const body = [
      'Bonjour,',
      '',
      "Je souhaite faire ajouter mon avion à la base ALFlight :",
      '',
      `• Immatriculation : ${form.registration.trim().toUpperCase() || '—'}`,
      `• Constructeur / modèle : ${form.model.trim() || '—'}`,
      form.message.trim() ? `• Remarques : ${form.message.trim()}` : null,
      '',
      '⚠️ Je joins le manuel de vol (PDF) à cet e-mail.',
      '',
      'Merci !',
    ].filter((l) => l !== null).join('\n');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', marginBottom: '10px',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
    backgroundColor: '#ffffff', fontSize: 'var(--fs-body)'
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', borderRadius: 'var(--radius-sm)',
          border: 'none', backgroundColor: 'var(--accent-primary)',
          color: '#ffffff', fontWeight: 600, cursor: 'pointer',
          fontSize: 'var(--fs-body)', ...style
        }}
      >
        <Mail size={16} />
        Envoyer le manuel de vol
      </button>
    );
  }

  return (
    <div style={{
      maxWidth: '420px', textAlign: 'left', padding: '16px',
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--bg-overlay)', ...style
    }}>
      <p style={{ fontWeight: 700, marginBottom: '10px', fontSize: 'var(--fs-body)' }}>
        Demande d'ajout de votre avion
      </p>
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Immatriculation *</label>
      <input style={inputStyle} value={form.registration} onChange={set('registration')} placeholder="Ex : F-GABC" autoComplete="off" />
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Constructeur / modèle</label>
      <input style={inputStyle} value={form.model} onChange={set('model')} placeholder="Ex : Robin DR400-120" autoComplete="off" />
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Remarques (optionnel)</label>
      <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.message} onChange={set('message')} />
      <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
        Votre logiciel de mail va s'ouvrir, pré-rempli. <strong>Joignez-y le PDF du
        manuel de vol</strong> avant d'envoyer — l'administrateur créera la fiche.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={handleSend}
          disabled={!form.registration.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            backgroundColor: form.registration.trim() ? 'var(--accent-primary)' : 'var(--border-subtle)',
            color: '#ffffff', fontWeight: 700,
            cursor: form.registration.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          <Send size={15} />
          Préparer l'e-mail
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            padding: '9px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer'
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
};

export default SendManualRequestButton;
