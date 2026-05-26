// src/shared/components/SupabaseErrorBanner.jsx
//
// Bandeau d'erreur rouge fixe affiché en haut de l'app dès qu'une erreur
// critique a été enregistrée via recordSupabaseError(). Persiste via
// localStorage → survit aux reloads, à la navigation et à HMR Vite.

import React, { useEffect, useState, useCallback } from 'react';
import {
  readLastSupabaseError,
  clearLastSupabaseError,
  PERSISTENT_ERROR_EVENT
} from '../../lib/persistentErrorLog';

export function SupabaseErrorBanner() {
  const [error, setError] = useState(() => readLastSupabaseError());
  const [expanded, setExpanded] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    const onEvt = (e) => setError(e.detail || null);
    const onStorage = (e) => {
      if (e.key === 'alflight:lastSupabaseError') {
        setError(readLastSupabaseError());
      }
    };
    window.addEventListener(PERSISTENT_ERROR_EVENT, onEvt);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PERSISTENT_ERROR_EVENT, onEvt);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    clearLastSupabaseError();
    setError(null);
    setExpanded(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(error, null, 2));
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // Fallback (très vieux navigateurs)
      const ta = document.createElement('textarea');
      ta.value = JSON.stringify(error, null, 2);
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopyOk(true); setTimeout(() => setCopyOk(false), 2000); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  }, [error]);

  if (!error) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        backgroundColor: '#7f1d1d',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        lineHeight: 1.4,
        borderBottom: '3px solid #ef4444'
      }}
    >
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🚨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            Erreur Supabase persistante — contexte : <code style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3 }}>{error.context}</code>
          </div>
          <div style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: 0.95
          }}>
            {error.message}
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={btnStyle('rgba(255,255,255,0.15)')}
          title="Voir/cacher les détails complets"
        >
          {expanded ? 'Cacher' : 'Détails'}
        </button>
        <button onClick={handleCopy} style={btnStyle('rgba(255,255,255,0.15)')}>
          {copyOk ? '✓ Copié' : '📋 Copier'}
        </button>
        <button onClick={handleDismiss} style={btnStyle('#ef4444')}>
          ✕ Fermer
        </button>
      </div>
      {expanded && (
        <pre style={{
          margin: 0,
          padding: '10px 16px 14px 50px',
          backgroundColor: 'rgba(0,0,0,0.35)',
          color: 'rgba(242, 105, 33, 0.10)',
          fontSize: 11,
          maxHeight: 280,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
{JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  );
}

const btnStyle = (bg) => ({
  padding: '4px 10px',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  color: 'white',
  backgroundColor: bg,
  whiteSpace: 'nowrap'
});

export default SupabaseErrorBanner;
