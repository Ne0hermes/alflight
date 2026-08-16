// src/features/aircraft/components/SendManualRequestButton.jsx
// 🔐 Phase 1 RBAC — parcours UTILISATEUR quand son avion n'est pas dans la
// base communautaire : un VRAI formulaire avec PIÈCE JOINTE (v2, 2026-08-16).
//
// v1 : mailto seul (pas de pièce jointe possible depuis un navigateur).
// v2 : le PDF du manuel est TÉLÉVERSÉ dans le bucket privé Supabase
//      « aircraft-requests » + la demande est enregistrée en base
//      (table aircraft_requests, visible par l'admin). L'e-mail devient une
//      simple notification optionnelle. Prérequis : supabase-aircraft-requests.sql.

import React, { useState, useRef } from 'react';
import { Mail, Send, Paperclip, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAirportsList } from '@shared/hooks/useAirportNames';

export const SUPPORT_EMAIL = 'assistance@alflight.fr';
const MAX_FILE_MB = 50;

const SendManualRequestButton = ({ style }) => {
  const [open, setOpen] = useState(false);
  // Base d'attache à la place du modèle (décision César 16/08) : l'admin sait
  // OÙ est basé l'avion — la fiche du wizard exploite directement ce champ.
  const [form, setForm] = useState({ registration: '', homeBase: '', message: '' });
  const airports = useAirportsList();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // { registration }
  const fileInputRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Le manuel doit être un fichier PDF.');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_FILE_MB} Mo).`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const canSend = form.registration.trim() && form.homeBase.trim() && file && !busy;

  const handleSend = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée — reconnectez-vous.');

      const reg = form.registration.trim().toUpperCase();

      // 🛡️ ANTI-DOUBLON (demande César 2026-08-16) — vérifié JUSTE AVANT l'envoi :
      // a) l'avion existe déjà dans la base communautaire → importer, pas demander
      setProgressMsg('Vérification de l\'immatriculation…');
      const { data: existing } = await supabase
        .from('community_presets')
        .select('id')
        .ilike('registration', reg)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error(`${reg} existe déjà dans la base communautaire — importez-le directement depuis la recherche ci-dessus, inutile d'envoyer le manuel.`);
      }
      // b) une demande est déjà en cours pour cette immatriculation (la fonction
      //    ne renvoie qu'un booléen : les demandes des autres restent privées)
      const { data: pendingExists, error: rpcErr } = await supabase
        .rpc('aircraft_request_pending', { reg });
      if (!rpcErr && pendingExists === true) {
        throw new Error(`Une demande pour ${reg} est déjà en cours de traitement — l'avion sera bientôt disponible, inutile de renvoyer le manuel.`);
      }

      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;

      // 1. Téléversement du PDF (bucket privé, dossier de l'utilisateur)
      setProgressMsg('Téléversement du manuel…');
      const { error: upErr } = await supabase.storage
        .from('aircraft-requests')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw new Error('Téléversement échoué : ' + upErr.message);

      // 2. Enregistrement de la demande (visible par l'administrateur)
      setProgressMsg('Enregistrement de la demande…');
      const { error: insErr } = await supabase.from('aircraft_requests').insert({
        user_email: user.email,
        registration: reg,
        home_base: form.homeBase.trim() || null,
        message: form.message.trim() || null,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
      });
      if (insErr) {
        // Revue 16/08 : l'upload a déjà eu lieu — retirer le PDF pour ne pas
        // laisser un fichier orphelin dans le bucket (policy delete-own requise).
        try { await supabase.storage.from('aircraft-requests').remove([path]); } catch { /* purge admin possible via dashboard */ }
        throw new Error('Enregistrement échoué : ' + insErr.message);
      }

      setDone({ registration: reg });
    } catch (e) {
      setError(e?.message || 'Envoi impossible. Réessayez ou contactez le support.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', marginBottom: '10px',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
    backgroundColor: '#ffffff', fontSize: 'var(--fs-body)'
  };
  const btn = (bg, disabled = false) => ({
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
    backgroundColor: disabled ? 'var(--border-subtle)' : bg, color: '#ffffff',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--fs-body)'
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...btn('var(--accent-primary)'), ...style }}>
        <Mail size={16} />
        Envoyer le manuel de vol
      </button>
    );
  }

  if (done) {
    return (
      <div style={{
        maxWidth: '420px', textAlign: 'left', padding: '16px',
        border: '1px solid #10b981', borderRadius: 'var(--radius-sm)',
        backgroundColor: 'rgba(16, 185, 129, 0.08)', ...style
      }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '8px' }}>
          <CheckCircle size={18} color="#10b981" />
          Demande envoyée pour {done.registration}
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: 0 }}>
          Votre manuel de vol a été transmis. L'administrateur créera la fiche
          avion — vous serez prévenu ici même dès qu'elle sera disponible dans
          la base communautaire (suivi dans « Mes demandes d'ajout »).
        </p>
      </div>
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
      <input style={inputStyle} value={form.registration} onChange={set('registration')} placeholder="Ex : F-GABC" autoComplete="off" disabled={busy} />
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Base d'attache (aéroclub / aérodrome) *</label>
      <input
        style={inputStyle}
        value={form.homeBase}
        onChange={set('homeBase')}
        placeholder="Ex : LFLP — Annecy Meythet"
        autoComplete="off"
        disabled={busy}
        list="alflight-homebase-airports"
      />
      <datalist id="alflight-homebase-airports">
        {airports.map((a) => (
          <option key={a.icao} value={`${a.icao} — ${a.name}`} />
        ))}
      </datalist>
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Remarques (optionnel)</label>
      <textarea style={{ ...inputStyle, minHeight: '54px', resize: 'vertical' }} value={form.message} onChange={set('message')} disabled={busy} />

      {/* Pièce jointe : le manuel de vol (PDF) — téléversé directement */}
      <label style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>Manuel de vol (PDF) *</label>
      <div style={{ marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--accent-primary)', backgroundColor: 'transparent',
            color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 'var(--fs-body)'
          }}
        >
          <Paperclip size={15} />
          {file ? `${file.name} (${(file.size / 1048576).toFixed(1)} Mo)` : 'Joindre le PDF du manuel…'}
        </button>
        <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="button" onClick={handleSend} disabled={!canSend} style={btn('var(--accent-primary)', !canSend)}>
          <Send size={15} />
          {busy ? (progressMsg || 'Envoi…') : 'Envoyer la demande'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setFile(null); }}
          disabled={busy}
          style={{
            padding: '9px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer'
          }}
        >
          Fermer
        </button>
      </div>
      {error && (
        <p style={{ marginTop: '10px', color: 'var(--color-red-critical)', fontSize: 'var(--fs-body)' }}>{error}</p>
      )}
    </div>
  );
};

export default SendManualRequestButton;
