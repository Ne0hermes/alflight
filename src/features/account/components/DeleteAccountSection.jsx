// src/features/account/components/DeleteAccountSection.jsx
// 🔐 Phase 1 (Lot 1.4) — Zone danger : suppression définitive du compte.
// Exigence App Store (5.1.1(v)) et Google Play : un utilisateur doit pouvoir
// supprimer son compte DANS l'app. Double confirmation par saisie du mot
// SUPPRIMER. Un admin est refusé par la fonction serveur (garde-fou).

import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteMyAccount } from '../../../services/accountService';

const DeleteAccountSection = () => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const armed = confirmText.trim().toUpperCase() === 'SUPPRIMER';

  const handleDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      // Compte supprimé + données locales purgées : retour à l'écran de connexion.
      window.location.reload();
    } catch (e) {
      setError(e?.message || 'La suppression a échoué. Réessayez ou contactez le support.');
      setBusy(false);
    }
  };

  return (
    <div style={{
      marginTop: '32px',
      padding: '16px',
      border: '1px solid var(--color-red-critical)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'rgba(220, 38, 38, 0.06)'
    }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-red-critical)', fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: '8px' }}>
        <AlertTriangle size={18} />
        Zone danger — Supprimer mon compte
      </h3>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Suppression <strong>définitive</strong> : votre compte, vos préparations de vol,
        vos PDF validés et vos données locales sur cet appareil seront effacés.
        Les points VFR que vous avez partagés sont conservés anonymisés.
        Cette action est irréversible.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-red-critical)', backgroundColor: 'transparent',
            color: 'var(--color-red-critical)', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Supprimer mon compte…
        </button>
      ) : (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--fs-body)', marginBottom: '6px' }}>
            Pour confirmer, tapez <strong>SUPPRIMER</strong> :
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            autoComplete="off"
            style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', marginRight: '10px',
              backgroundColor: '#ffffff', width: '160px'
            }}
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={!armed || busy}
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
              backgroundColor: armed && !busy ? 'var(--color-red-critical)' : 'var(--border-subtle)',
              color: '#ffffff', fontWeight: 700, cursor: armed && !busy ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Trash2 size={16} />
            {busy ? 'Suppression en cours…' : 'Supprimer définitivement'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setConfirmText(''); setError(null); }}
            disabled={busy}
            style={{
              marginLeft: '10px', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            Annuler
          </button>
          {error && (
            <p style={{ marginTop: '10px', color: 'var(--color-red-critical)', fontSize: 'var(--fs-body)' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DeleteAccountSection;
